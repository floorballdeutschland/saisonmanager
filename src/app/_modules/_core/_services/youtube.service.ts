import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

/** Nur das, was hier gebraucht wird -- kein Typpaket für die ganze GIS-Bibliothek. */
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

/** Nur die Felder, die hier gelesen werden -- kein Abbild der ganzen Antwort. */
interface YoutubeApiItem {
  id: string;
  snippet?: { title?: string };
  cdn?: { ingestionInfo?: { streamName?: string } };
}

interface YoutubeApiResponse {
  id?: string;
  nextPageToken?: string;
  items?: YoutubeApiItem[];
}

export interface YoutubeStream {
  id: string;
  title: string;
}

export interface YoutubeBroadcastInput {
  title: string;
  description: string;
  /** Anwurf als ISO-Zeitpunkt. */
  scheduledStartTime: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
}

export class YoutubeError extends Error {}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
/**
 * Frist für den Anmeldedialog. Google ruft für die üblichen Abbrüche
 * `error_callback` -- aber nicht garantiert für jeden Fall. Bleibt er aus,
 * hinge der Anlegevorgang mit „wird angelegt …" bis zum Neuladen der Seite.
 */
const SIGN_IN_TIMEOUT_MS = 120000;
const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const API_ROOT = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_ROOT = 'https://www.googleapis.com/upload/youtube/v3';

/**
 * Legt YouTube-Übertragungen an -- aus dem Browser heraus, nicht vom Server.
 *
 * WARUM IM BROWSER: Zu jeder Übertragung gehört ein Thumbnail, und das entsteht
 * hier auf einer Leinwand (`renderThumbnailPng`, derselbe Code wie im
 * Spielbericht). Serverseitig müsste der ganze Bildaufbau in Ruby nachgebaut
 * werden -- ein zweiter Zeichenweg, der unweigerlich vom ersten abwiche.
 * Nebenbei bleibt so kein dauerhaftes Zugangstoken auf dem Server liegen: Der
 * Anwender meldet sich mit dem Google-Konto an, das den Kanal verwaltet, und das
 * Token gilt eine Stunde.
 *
 * Der Gegenfall ist der Wächter, der abends die Übertragungen beendet: Der läuft
 * unbeaufsichtigt und liegt deshalb im Backend.
 *
 * OHNE `googleClientId` TUT DIESER DIENST NICHTS und sagt das über
 * `configured`. Das ist der Normalzustand in der Entwicklung; die Oberfläche
 * blendet das Anlegen dann aus, statt in einen Anmeldefehler zu laufen.
 */
@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private _token: string | null = null;
  private _tokenClient: TokenClient | null = null;
  private _scriptLoaded: Promise<void> | null = null;

  public get configured(): boolean {
    // Der Platzhalter überlebt einen Bau ohne hinterlegte Kennung; er ist keine
    // gültige Client-ID und darf nicht als „eingerichtet" durchgehen.
    const id = environment.googleClientId;
    return !!id && !id.includes('PLACEHOLDER');
  }

  public get signedIn(): boolean {
    return !!this._token;
  }

  /**
   * Holt ein Zugangstoken, notfalls über den Anmeldedialog.
   *
   * Ein Token gilt rund eine Stunde. Ein Stapel dauert Minuten, ein zweiter
   * Durchgang am selben Nachmittag kann aber darüber hinausgehen -- läuft es ab,
   * meldet die Schnittstelle 401, und der Aufrufer schickt den Anwender hierher
   * zurück.
   */
  public async signIn(): Promise<void> {
    if (!this.configured) {
      throw new YoutubeError(
        'Für dieses System ist kein Google-Zugang hinterlegt.'
      );
    }
    if (this._token) return;

    await this._loadScript();

    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      throw new YoutubeError(
        'Die Google-Anmeldung ließ sich nicht laden. Blockiert ein Browser-Add-on accounts.google.com?'
      );
    }

    this._token = await new Promise<string>((resolve, reject) => {
      const frist = setTimeout(
        () =>
          reject(
            new YoutubeError(
              'Die Google-Anmeldung wurde nicht abgeschlossen. Wurde das Fenster geschlossen?'
            )
          ),
        SIGN_IN_TIMEOUT_MS
      );
      const fertig =
        <T>(fn: (wert: T) => void) =>
        (wert: T) => {
          clearTimeout(frist);
          fn(wert);
        };

      this._tokenClient = oauth2.initTokenClient({
        client_id: environment.googleClientId,
        scope: SCOPE,
        callback: fertig((response: TokenResponse) => {
          if (response.access_token) resolve(response.access_token);
          else {
            reject(
              new YoutubeError(
                `Die Anmeldung wurde nicht abgeschlossen (${
                  response.error_description || response.error || 'abgebrochen'
                }).`
              )
            );
          }
        }),
        error_callback: fertig((error: { type?: string }) =>
          reject(
            new YoutubeError(
              `Die Anmeldung wurde abgebrochen (${error.type || 'unbekannt'}).`
            )
          )
        ),
      });

      this._tokenClient.requestAccessToken();
    });
  }

  public signOut(): void {
    this._token = null;
  }

  /**
   * Die vorhandenen Streamschlüssel des Kanals, als Zuordnung
   * Schlüssel → Stream-Ressource.
   *
   * Eine Übertragung wird nicht über den Schlüssel an einen Stream gebunden,
   * sondern über dessen Ressourcen-Kennung -- die steht nur hier. Angelegt wird
   * NICHTS: Die Schlüssel sind je Verein dauerhaft eingerichtet, und ein
   * versehentlich neu erzeugter Stream nützt niemandem, der schon sendet.
   */
  public async streamsByKey(): Promise<Map<string, YoutubeStream>> {
    const gefunden = new Map<string, YoutubeStream>();
    let seite: string | undefined;

    do {
      const antwort = await this._get('liveStreams', {
        part: 'id,snippet,cdn',
        mine: 'true',
        maxResults: '50',
        ...(seite ? { pageToken: seite } : {}),
      });

      for (const item of antwort.items ?? []) {
        const key = item.cdn?.ingestionInfo?.streamName;
        if (key)
          gefunden.set(key, { id: item.id, title: item.snippet?.title ?? '' });
      }
      seite = antwort.nextPageToken;
    } while (seite);

    return gefunden;
  }

  /**
   * True, wenn der Kanal überhaupt keine Streamschlüssel führt.
   *
   * Dann liegt die Ursache am Kanalzugang und nicht an den Vereinsdaten -- ohne
   * diese Unterscheidung meldet die Oberfläche für jedes Spiel „Streamschlüssel
   * ist auf dem Kanal nicht vorhanden" und beschuldigt damit die falschen Daten.
   */
  public keineStreamsVorhanden(streams: Map<string, YoutubeStream>): boolean {
    return streams.size === 0;
  }

  /** Die Playlist mit diesem Namen, oder eine neu angelegte. */
  public async ensurePlaylist(name: string): Promise<string> {
    let seite: string | undefined;

    do {
      const antwort = await this._get('playlists', {
        part: 'id,snippet',
        mine: 'true',
        maxResults: '50',
        ...(seite ? { pageToken: seite } : {}),
      });

      const treffer = (antwort.items ?? []).find(
        (item) => item.snippet?.title?.toLowerCase() === name.toLowerCase()
      );
      if (treffer) return treffer.id;
      seite = antwort.nextPageToken;
    } while (seite);

    const angelegt = await this._post(
      'playlists',
      { part: 'snippet,status' },
      {
        snippet: { title: name },
        status: { privacyStatus: 'public' },
      }
    );
    if (!angelegt.id)
      throw new YoutubeError('Die Playlist wurde ohne Kennung angelegt.');
    return angelegt.id;
  }

  public async createBroadcast(input: YoutubeBroadcastInput): Promise<string> {
    const antwort = await this._post(
      'liveBroadcasts',
      { part: 'snippet,status,contentDetails' },
      {
        snippet: {
          title: input.title,
          description: input.description,
          scheduledStartTime: input.scheduledStartTime,
        },
        status: {
          privacyStatus: input.privacyStatus,
          selfDeclaredMadeForKids: false,
        },
        contentDetails: {
          // Die Übertragung geht von selbst auf Sendung, sobald der Verein sein
          // Signal schickt -- niemand aus dem Verband sitzt dafür am Rechner.
          enableAutoStart: true,
          // NICHT automatisch beenden: Das übernimmt der Wächter im Backend,
          // und der weiß im Gegensatz zu YouTube, ob das Spiel vorbei ist.
          enableAutoStop: false,
          enableEmbed: true,
          recordFromStart: true,
          enableDvr: true,
        },
      }
    );

    // Ohne Kennung liefe die leere Zeichenkette in `bind('')` weiter -- die
    // Übertragung existiert dann, ihre Kennung ist verloren, und niemand kann
    // sie mehr zuordnen oder beenden. Das ist der Waisenfall in Reinform.
    if (!antwort.id) {
      throw new YoutubeError(
        'YouTube hat die Übertragung ohne Kennung angelegt. Sie muss von Hand gesucht werden.'
      );
    }
    return antwort.id;
  }

  public async bind(broadcastId: string, streamId: string): Promise<void> {
    await this._post('liveBroadcasts/bind', {
      id: broadcastId,
      streamId,
      part: 'id,contentDetails',
    });
  }

  /**
   * Lädt das Thumbnail hoch.
   *
   * Kurz nach dem Anlegen kennt die Video-Schnittstelle die Übertragung
   * gelegentlich noch nicht und antwortet mit 404. Das bisherige Python-Skript
   * wartete deshalb pauschal zehn Sekunden je Bild -- bei zwanzig Spielen über
   * drei Minuten Nichtstun. Zwei kurze Wiederholungen erledigen dasselbe und
   * kosten im Normalfall nichts.
   */
  public async uploadThumbnail(broadcastId: string, blob: Blob): Promise<void> {
    for (let versuch = 0; ; versuch++) {
      try {
        await this._upload(broadcastId, blob);
        return;
      } catch (error) {
        const status = error instanceof YoutubeStatusError ? error.status : 0;
        if ((status === 404 || status === 409) && versuch < 2) {
          await warte(2000 * (versuch + 1));
          continue;
        }
        throw error;
      }
    }
  }

  /** Position 0: die neueste Übertragung steht oben in der Playlist. */
  public async addToPlaylist(
    playlistId: string,
    videoId: string,
    position = 0
  ): Promise<void> {
    await this._post(
      'playlistItems',
      { part: 'snippet' },
      {
        snippet: {
          playlistId,
          position,
          resourceId: { kind: 'youtube#video', videoId },
        },
      }
    );
  }

  private _loadScript(): Promise<void> {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (this._scriptLoaded) return this._scriptLoaded;

    this._scriptLoaded = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Ein zweiter Versuch soll das Skript neu laden dürfen: Der Fehlschlag
        // liegt fast immer an der Verbindung und ist nicht dauerhaft.
        this._scriptLoaded = null;
        reject(new YoutubeError('Die Google-Anmeldung ließ sich nicht laden.'));
      };
      document.head.appendChild(script);
    });

    return this._scriptLoaded;
  }

  private async _get(
    pfad: string,
    params: Record<string, string>
  ): Promise<YoutubeApiResponse> {
    const url = `${API_ROOT}/${pfad}?${new URLSearchParams(params)}`;
    return this._request(url, { method: 'GET', headers: this._headers() });
  }

  private async _post(
    pfad: string,
    params: Record<string, string>,
    body?: unknown
  ): Promise<YoutubeApiResponse> {
    const url = `${API_ROOT}/${pfad}?${new URLSearchParams(params)}`;
    return this._request(url, {
      method: 'POST',
      headers: {
        ...this._headers(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async _upload(
    videoId: string,
    blob: Blob
  ): Promise<YoutubeApiResponse> {
    const url = `${UPLOAD_ROOT}/thumbnails?videoId=${encodeURIComponent(
      videoId
    )}&uploadType=media`;

    return this._request(url, {
      method: 'POST',
      headers: { ...this._headers(), 'Content-Type': blob.type || 'image/png' },
      body: blob,
    });
  }

  private _headers(): Record<string, string> {
    if (!this._token) throw new YoutubeError('Nicht bei Google angemeldet.');
    return { Authorization: `Bearer ${this._token}` };
  }

  private async _request(
    url: string,
    init: RequestInit
  ): Promise<YoutubeApiResponse> {
    const antwort = await fetch(url, init);

    if (!antwort.ok) {
      // Ein abgelaufenes Token wird hier verworfen, damit der nächste Anlauf den
      // Anmeldedialog zeigt statt endlos 401 zu bekommen.
      if (antwort.status === 401) this._token = null;
      throw new YoutubeStatusError(antwort.status, await lesegrund(antwort));
    }

    const text = await antwort.text();
    if (!text) return {};

    try {
      return JSON.parse(text) as YoutubeApiResponse;
    } catch {
      // Sonst stünde ein "Unexpected token < in JSON…" in der Ergebniszeile --
      // und wenn es die Antwort auf `createBroadcast` trifft, ist die
      // Übertragung angelegt und ihre Kennung verloren.
      throw new YoutubeStatusError(
        antwort.status,
        'YouTube hat eine unlesbare Antwort geschickt.'
      );
    }
  }
}

/** Ein Fehler der Schnittstelle samt HTTP-Status, für gezielte Wiederholungen. */
export class YoutubeStatusError extends YoutubeError {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * Der Grund aus der Fehlerantwort.
 *
 * Ohne ihn steht in der Meldung nur eine Statuszeile, und der Unterschied
 * zwischen „Kontingent erschöpft" und „keine Rechte auf diesem Kanal" ist genau
 * der zwischen Abwarten und Handeln.
 */
/**
 * Deutsche Handlungssätze zu den Gründen, die wirklich vorkommen.
 *
 * Der rohe Bezeichner der Schnittstelle (`quotaExceeded`, `forbidden`) landet
 * sonst unübersetzt in der Oberfläche, und der Unterschied zwischen "morgen
 * wiederkommen" und "Kanalzugang klären" -- genau der, auf den es ankommt --
 * bliebe dem Anwender verborgen.
 */
const GRUND_TEXTE: Record<string, string> = {
  quotaExceeded:
    'Das YouTube-Tageskontingent ist erschöpft. Es füllt sich um 9 Uhr deutscher Zeit wieder auf.',
  rateLimitExceeded:
    'YouTube bremst gerade ab. In ein paar Minuten noch einmal versuchen.',
  forbidden: 'Dieses Konto darf auf dem Kanal nichts anlegen.',
  insufficientPermissions:
    'Dem angemeldeten Konto fehlen die Rechte auf dem Verbandskanal.',
  authError: 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.',
  liveStreamingNotEnabled:
    'Für diesen Kanal ist Livestreaming nicht freigeschaltet.',
  invalidTitle: 'Der Titel wird von YouTube abgewiesen (Länge oder Zeichen).',
  liveBroadcastBindingNotAllowed:
    'Die Übertragung lässt sich in ihrem Zustand nicht mehr an den Stream binden.',
};

export function youtubeGrundText(reason: string): string | null {
  return GRUND_TEXTE[reason] ?? null;
}

async function lesegrund(antwort: Response): Promise<string> {
  try {
    const text = await antwort.text();
    const daten = text ? JSON.parse(text) : null;
    const reason = daten?.error?.errors?.[0]?.reason ?? '';
    const handlungssatz = youtubeGrundText(reason);
    if (handlungssatz) return handlungssatz;

    const grund = reason || daten?.error?.message || '';
    return grund ? `${antwort.status}: ${grund}` : `${antwort.status}`;
  } catch {
    // Auch ein unlesbarer Körper darf nicht nur eine nackte Zahl hinterlassen.
    return `${antwort.status} (Antwort nicht lesbar)`;
  }
}

function warte(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
