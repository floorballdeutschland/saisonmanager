import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import * as Sentry from '@sentry/angular';
import {
  LeagueService,
  NotificationService,
  StreamingService,
  YoutubeService,
} from '@floorball/core';
import { League, StreamingGame, StreamingTemplates } from '@floorball/types';
import {
  filenameSlug,
  renderThumbnailPng,
  saveBlob,
} from 'src/app/_helpers/_utils/stream-thumbnail';
import {
  ThumbnailBatchItem,
  renderThumbnailBatch,
  thumbnailInput,
} from 'src/app/_helpers/_utils/thumbnail-batch';
import {
  STREAM_PLACEHOLDERS,
  STREAM_TITLE_MAX,
  applyStreamTemplate,
  sanitizeStreamTitle,
} from 'src/app/_helpers/_utils/stream-template';
import { buildZip } from 'src/app/_helpers/_utils/zip-store';

type Mode = 'range' | 'matchday';

/** Was aus einem Anlauf je Spiel geworden ist. */
export interface CreationResult {
  level: 'success' | 'warning' | 'error';
  text: string;
}

interface LeagueOption {
  id: number;
  name: string;
}

/**
 * Der Streaming-Bereich: die Spiele, für die Übertragungen eingerichtet werden.
 *
 * WOFÜR: Bisher lief das über eine Excel-Datei der Spielbetriebskommission --
 * ein Blatt je Saison, aus dem eine Formel die Titel baute, die dann als CSV in
 * ein Python-Skript ging. Diese Ansicht ersetzt die beiden Blätter „Übersicht"
 * und „Erstellung und Kontrolle": Was ansteht, worüber es gesendet wird, und was
 * schon eingerichtet ist.
 *
 * ZWEI ZUSCHNITTE, WEIL SO GEARBEITET WIRD:
 *
 *   * Zeitraum -- ein Wochenende quer über alle Ligen, nach Anwurf sortiert.
 *     Genau so ist die Vorlage aufgebaut: 1. FBL Herren, FD-Pokal und 2. FBL
 *     stehen dort gemischt untereinander, weil sie nacheinander eingerichtet
 *     werden.
 *   * Spieltag einer Liga -- „Spieltag 1" vollständig. Im Datenmodell ist ein
 *     Spieltag ein Spieltags*ORT* (Halle plus Ausrichter), und ein Spieltag 1
 *     besteht aus mehreren davon. Der Knopf im Ligaspielplan hängt an einem
 *     einzelnen Ort, hier stehen sie zusammen.
 *
 * ÜBERSETZT, anders als die übrige Streaming-Familie (`fb-stream-graphics`,
 * `fb-overlay-links`): Jene sind einzelne Knöpfe, die in fremden Ansichten
 * sitzen; dies hier ist ein eigener Verwaltungsbereich mit Route und
 * Menüeintrag, und für die gilt im Haus ein Scope je Modul.
 */
@Component({
  selector: 'fb-streaming-index',
  templateUrl: './streaming-index.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StreamingIndexComponent implements OnInit, OnDestroy {
  public mode: Mode = 'range';
  public from = '';
  public to = '';
  public leagueId: number | null = null;
  public gameDayNumber = 1;

  public leagues: LeagueOption[] = [];
  public games: StreamingGame[] = [];
  public selected = new Set<number>();

  public loading = false;
  /** Der Abruf ist gescheitert -- NICHT dasselbe wie „nichts gefunden". */
  public loadError = false;
  public loaded = false;

  public busy = false;
  public done = 0;

  public templates: StreamingTemplates | null = null;
  public titleTemplate = '';
  public descriptionTemplate = '';
  public privacy: 'public' | 'unlisted' = 'public';
  public templatesOpen = false;
  public savingTemplates = false;

  public creating = false;
  public createdDone = 0;
  public results = new Map<number, CreationResult>();

  public readonly placeholders = STREAM_PLACEHOLDERS;
  public readonly titleMax = STREAM_TITLE_MAX;

  private _leagueCache = new Map<number, League | null>();
  private _playlistCache = new Map<string, string>();
  private _destroyed = false;

  constructor(
    private _streamingService: StreamingService,
    private _youtubeService: YoutubeService,
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    const [von, bis] = kommendesWochenende();
    this.from = von;
    this.to = bis;
    this._loadLeagues();
    this._loadTemplates();
    this.load();
  }

  public ngOnDestroy(): void {
    this._destroyed = true;
  }

  public get selectedGames(): StreamingGame[] {
    return this.games.filter((game) => this.selected.has(game.id));
  }

  public get allSelected(): boolean {
    return this.games.length > 0 && this.selected.size === this.games.length;
  }

  /** Wie viele der ausgewählten Spiele überhaupt einen Schlüssel haben. */
  public get selectedStreamable(): number {
    return this.selectedGames.filter((game) => game.streamable).length;
  }

  public load(): void {
    if (this.mode === 'matchday' && !this.leagueId) return;

    this.loading = true;
    this.loadError = false;
    this._cdr.markForCheck();

    const filter =
      this.mode === 'range'
        ? { from: this.from, to: this.to }
        : { leagueId: this.leagueId!, gameDayNumber: this.gameDayNumber };

    this._streamingService.getGames(filter).subscribe({
      next: (games) => {
        this.games = games;
        // Auswahl nicht über einen Wechsel des Zuschnitts retten: Sie bezöge
        // sich auf Spiele, die niemand mehr sieht, und die Sammelaktion liefe
        // über etwas anderes als das Angezeigte.
        this.selected.clear();
        this.loading = false;
        this.loaded = true;
        this._cdr.markForCheck();
      },
      error: (error) => {
        // „Keine Spiele gefunden" wäre hier eine Tatsachenbehauptung, die
        // niemand geprüft hat -- und ausgerechnet die Aussage, wegen der die
        // Seite geöffnet wurde.
        this._capture(error);
        this.games = [];
        this.loading = false;
        this.loadError = true;
        this._cdr.markForCheck();
      },
    });
  }

  public setMode(mode: Mode): void {
    if (this.mode === mode) return;

    this.mode = mode;
    this.games = [];
    this.selected.clear();
    this.loaded = false;
    this._cdr.markForCheck();
    if (mode === 'range' || this.leagueId) this.load();
  }

  public toggle(game: StreamingGame): void {
    if (this.selected.has(game.id)) this.selected.delete(game.id);
    else this.selected.add(game.id);
    this._cdr.markForCheck();
  }

  public toggleAll(): void {
    if (this.allSelected) this.selected.clear();
    else this.games.forEach((game) => this.selected.add(game.id));
    this._cdr.markForCheck();
  }

  /**
   * Die Thumbnails der Auswahl als ein Archiv.
   *
   * Der Knopf im Ligaspielplan kann das nur je Spieltagsort -- bei sechs Hallen
   * sechs Archive. Hier ist es eine Datei, sortiert wie die Liste, mit einem
   * Ordner je Spieltag darin.
   */
  public async downloadThumbnails(): Promise<void> {
    const auswahl = this.selectedGames;
    if (this.busy || !auswahl.length) return;

    this.busy = true;
    this.done = 0;
    this._cdr.markForCheck();

    try {
      const items: ThumbnailBatchItem[] = auswahl
        // Ohne Spieltag fehlen Datum und Halle, und beides steht im Bild. Das
        // kommt nur bei kaputten Daten vor, ist aber kein Grund, den ganzen
        // Stapel abzubrechen.
        .filter((game) => !!game.game_day)
        .map((game) => ({ game, gameDay: game.game_day! }));

      const { entries, report, aborted } = await renderThumbnailBatch(items, {
        league: (leagueId) => this._league(leagueId),
        progress: (done) => {
          this.done = done;
          this._cdr.markForCheck();
        },
        capture: (error) => this._capture(error),
        cancelled: () => this._destroyed,
      });

      if (aborted) return;

      if (!entries.length) {
        this._notificationService.error(
          `Es ließ sich kein einziges Thumbnail erzeugen. ${report.problems()}`.trim(),
          { keepAfterRouteChange: true }
        );
        return;
      }

      saveBlob(buildZip(entries), this._zipName());
      const { level, text } = report.result(entries.length, auswahl.length);
      this._notificationService[level](text, { keepAfterRouteChange: true });
    } catch (error) {
      this._capture(error);
      this._notificationService.error(
        `Die Bilder ließen sich nicht als Archiv speichern. ${
          error instanceof Error ? error.message : ''
        }`.trim(),
        { keepAfterRouteChange: true }
      );
    } finally {
      this.busy = false;
      this._cdr.markForCheck();
    }
  }

  // --- Vorlagen ------------------------------------------------------------

  public get youtubeReady(): boolean {
    return this._youtubeService.configured;
  }

  /** Der Titel, wie er am ersten ausgewählten Spiel aussähe. */
  public get titlePreview(): string {
    const beispiel = this.selectedGames[0] ?? this.games[0];
    if (!beispiel) return '';

    return sanitizeStreamTitle(applyStreamTemplate(this.titleTemplate, beispiel));
  }

  public get descriptionPreview(): string {
    const beispiel = this.selectedGames[0] ?? this.games[0];
    if (!beispiel) return '';

    return applyStreamTemplate(this.descriptionTemplate, beispiel);
  }

  public get titleTooLong(): boolean {
    return this.titlePreview.length >= STREAM_TITLE_MAX;
  }

  public resetTemplates(): void {
    if (!this.templates) return;

    this.titleTemplate = this.templates.default_title;
    this.descriptionTemplate = this.templates.default_description;
  }

  public saveTemplates(): void {
    this.savingTemplates = true;
    this._cdr.markForCheck();

    this._streamingService
      .saveTemplates({
        title: this.titleTemplate,
        description: this.descriptionTemplate,
      })
      .subscribe({
        next: (templates) => {
          this._applyTemplates(templates);
          this.savingTemplates = false;
          this._notificationService.success('Vorlagen gespeichert.');
          this._cdr.markForCheck();
        },
        error: (error) => {
          this._capture(error);
          this.savingTemplates = false;
          this._notificationService.error(
            'Die Vorlagen ließen sich nicht speichern.'
          );
          this._cdr.markForCheck();
        },
      });
  }

  // --- Übertragungen anlegen -----------------------------------------------

  /** Die Spiele, für die ein Anlauf überhaupt etwas täte. */
  public get creatable(): StreamingGame[] {
    return this.selectedGames.filter(
      (game) => game.streamable && !game.broadcast
    );
  }

  /**
   * Legt für die Auswahl die Übertragungen bei YouTube an.
   *
   * REIHENFOLGE JE SPIEL: anlegen, an den Stream binden, **beim Saisonmanager
   * melden**, dann Thumbnail und Playlist. Das Melden steht bewusst vor den
   * beiden letzten Schritten: Danach existiert die Übertragung, und ginge die
   * Meldung erst am Ende raus, wäre sie nach einem Fehlschlag beim Thumbnail
   * verloren -- der Wächter kennte die Übertragung nicht, und der nächste Klick
   * legte eine zweite an. Thumbnail und Playlist sind Beiwerk und werden als
   * Warnung gemeldet, nicht als Fehlschlag.
   *
   * Nacheinander und nicht parallel: YouTube zählt jeden Aufruf gegen ein
   * Tageskontingent, und bei einem Fehlschlag soll erkennbar bleiben, welches
   * Spiel ihn ausgelöst hat.
   */
  public async createStreams(): Promise<void> {
    const auswahl = this.creatable;
    if (this.creating || !auswahl.length) return;

    this.creating = true;
    this.createdDone = 0;
    this.results.clear();
    this._cdr.markForCheck();

    try {
      await this._youtubeService.signIn();
      const streams = await this._youtubeService.streamsByKey();

      for (const game of auswahl) {
        if (this._destroyed) return;
        await this._createOne(game, streams);
        this.createdDone += 1;
        this._cdr.markForCheck();
      }

      const erfolge = [...this.results.values()].filter(
        (result) => result.level !== 'error'
      ).length;
      const meldung = `${erfolge} von ${auswahl.length} Übertragungen angelegt.`;
      this._notificationService[erfolge === auswahl.length ? 'success' : 'warning'](
        meldung,
        { keepAfterRouteChange: true }
      );

      // Neu laden, damit die angelegten Übertragungen mit Link in der Liste
      // stehen -- und damit ein zweiter Klick sie nicht noch einmal anlegt.
      this.load();
    } catch (error) {
      this._capture(error);
      this._notificationService.error(
        error instanceof Error
          ? error.message
          : 'Das Anlegen ist unerwartet abgebrochen.',
        { keepAfterRouteChange: true }
      );
    } finally {
      this.creating = false;
      this._cdr.markForCheck();
    }
  }

  private async _createOne(
    game: StreamingGame,
    streams: Map<string, { id: string }>
  ): Promise<void> {
    const stream = game.stream_key ? streams.get(game.stream_key) : undefined;
    if (!stream) {
      // Der Schlüssel steht am Verein, aber auf dem Kanal gibt es ihn nicht --
      // meist ein Tippfehler beim Eintragen oder ein bei YouTube gelöschter
      // Stream. Ohne diesen Riegel entstünde eine Übertragung, die an nichts
      // gebunden ist und auf die niemand senden kann.
      this._result(game, 'error', 'Streamschlüssel ist auf dem Kanal nicht vorhanden.');
      return;
    }
    if (!game.start_at) {
      this._result(game, 'error', 'Ohne Anwurfzeit lässt sich kein Termin setzen.');
      return;
    }

    let broadcastId: string;
    try {
      broadcastId = await this._youtubeService.createBroadcast({
        title: sanitizeStreamTitle(applyStreamTemplate(this.titleTemplate, game)),
        description: applyStreamTemplate(this.descriptionTemplate, game),
        scheduledStartTime: game.start_at,
        privacyStatus: this.privacy,
      });
      await this._youtubeService.bind(broadcastId, stream.id);
    } catch (error) {
      this._capture(error);
      this._result(
        game,
        'error',
        error instanceof Error ? error.message : 'Anlegen fehlgeschlagen.'
      );
      return;
    }

    await this._report(game, broadcastId, stream.id);

    const hinweise: string[] = [];
    if (!(await this._thumbnail(game, broadcastId))) {
      hinweise.push('Thumbnail nicht hochgeladen');
    }
    if (!(await this._playlist(game, broadcastId))) {
      hinweise.push('nicht in die Playlist eingetragen');
    }

    if (hinweise.length) this._result(game, 'warning', `Angelegt, aber ${hinweise.join(' und ')}.`);
    else this._result(game, 'success', 'Angelegt.');
  }

  /**
   * Meldet die Übertragung beim Saisonmanager.
   *
   * Scheitert das, existiert die Übertragung trotzdem -- deshalb eine Warnung
   * und kein Fehlschlag. Der Preis ist allerdings hoch genug, um ihn zu nennen:
   * Der Wächter kennt sie dann nicht, und der nächste Klick legte eine zweite an.
   */
  private async _report(
    game: StreamingGame,
    broadcastId: string,
    streamId: string
  ): Promise<void> {
    try {
      await firstValueFrom(
        this._streamingService.recordBroadcast(game.id, {
          broadcast_id: broadcastId,
          privacy_status: this.privacy,
          title: sanitizeStreamTitle(applyStreamTemplate(this.titleTemplate, game)),
          stream_id: streamId,
        })
      );
    } catch (error) {
      this._capture(error);
      this._notificationService.warning(
        `Die Übertragung für ${game.home_team_name} – ${game.guest_team_name} ist angelegt, ` +
          'ließ sich aber nicht im Saisonmanager vermerken. Bitte den Link von Hand eintragen.',
        { keepAfterRouteChange: true }
      );
    }
  }

  private async _thumbnail(
    game: StreamingGame,
    broadcastId: string
  ): Promise<boolean> {
    if (!game.game_day) return false;

    try {
      const league = await this._league(game.game_day.league_id);
      const { blob } = await renderThumbnailPng(
        thumbnailInput({ game, gameDay: game.game_day }, league)
      );
      await this._youtubeService.uploadThumbnail(broadcastId, blob);
      return true;
    } catch (error) {
      this._capture(error);
      return false;
    }
  }

  private async _playlist(
    game: StreamingGame,
    broadcastId: string
  ): Promise<boolean> {
    const name = game.league?.stream_playlist?.trim();
    // Keine Playlist gepflegt heißt "gehört in keine" -- genau die Zeilen, die
    // in der alten Vorlage "KEINE PLAYLIST" trugen. Das ist kein Fehlschlag.
    if (!name) return true;

    try {
      let playlistId = this._playlistCache.get(name);
      if (!playlistId) {
        playlistId = await this._youtubeService.ensurePlaylist(name);
        this._playlistCache.set(name, playlistId);
      }
      await this._youtubeService.addToPlaylist(playlistId, broadcastId);
      return true;
    } catch (error) {
      this._capture(error);
      return false;
    }
  }

  private _result(
    game: StreamingGame,
    level: CreationResult['level'],
    text: string
  ): void {
    this.results.set(game.id, { level, text });
    this._cdr.markForCheck();
  }

  private _loadTemplates(): void {
    this._streamingService
      .getTemplates()
      .pipe(catchError(() => of(null)))
      .subscribe((templates) => {
        if (templates) this._applyTemplates(templates);
        this._cdr.markForCheck();
      });
  }

  private _applyTemplates(templates: StreamingTemplates): void {
    this.templates = templates;
    this.titleTemplate = templates.title;
    this.descriptionTemplate = templates.description;
  }

  /**
   * Die Liga, je Kennung einmal geholt.
   *
   * Ein Stapel über ein Wochenende umfasst mehrere Ligen; ohne diesen
   * Zwischenspeicher liefe je Spiel ein eigener Abruf. Ein Fehlschlag wird NICHT
   * behalten, sonst lieferte ein zweiter Klick nach einem kurzen Netzproblem
   * stillschweigend wieder Bilder ohne Wortmarke.
   */
  private async _league(leagueId: number): Promise<League | null> {
    const gemerkt = this._leagueCache.get(leagueId);
    if (gemerkt) return gemerkt;

    const league = await firstValueFrom(
      this._leagueService.getSingleLeague(leagueId).pipe(
        catchError((error) => {
          this._capture(error);
          return of(null);
        })
      )
    );

    if (league) this._leagueCache.set(leagueId, league);
    return league;
  }

  private _loadLeagues(): void {
    this._leagueService
      .getAdminLeagues()
      .pipe(catchError(() => of([])))
      .subscribe((operations) => {
        this.leagues = (operations ?? [])
          .flatMap((operation) => operation.leagues ?? [])
          .map((league) => ({ id: league.id, name: league.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'de'));
        this._cdr.markForCheck();
      });
  }

  private _zipName(): string {
    if (this.mode === 'matchday') {
      const liga = this.leagues.find((entry) => entry.id === this.leagueId);
      return `thumbnails-${filenameSlug(liga?.name || 'liga')}-spieltag-${
        this.gameDayNumber
      }.zip`;
    }

    return `thumbnails-${filenameSlug(this.from)}-bis-${filenameSlug(
      this.to
    )}.zip`;
  }

  private _capture(error: unknown): void {
    Sentry.captureException(error, {
      tags: { feature: 'streaming-admin' },
      extra: {
        mode: this.mode,
        from: this.from,
        to: this.to,
        leagueId: this.leagueId,
        gameDayNumber: this.gameDayNumber,
      },
    });
  }
}

/**
 * Freitag bis Sonntag der kommenden Runde als Vorbelegung.
 *
 * Gespielt wird am Wochenende, und eingerichtet wird in der Woche davor. Ein
 * Vorschlag „heute bis heute" wäre an fast jedem Tag leer und sähe aus, als
 * gäbe es nichts einzurichten. Ab Freitag zeigt das laufende Wochenende, davor
 * das kommende.
 */
export function kommendesWochenende(heute = new Date()): [string, string] {
  const freitag = new Date(heute);
  // 0 = Sonntag … 5 = Freitag, 6 = Samstag.
  const tag = freitag.getDay();
  const bisFreitag = tag === 0 ? -2 : tag <= 5 ? 5 - tag : -1;
  freitag.setDate(freitag.getDate() + bisFreitag);

  const sonntag = new Date(freitag);
  sonntag.setDate(sonntag.getDate() + 2);

  return [isoDate(freitag), isoDate(sonntag)];
}

function isoDate(date: Date): string {
  // Nicht `toISOString`: Das rechnet nach UTC um und liefert in der deutschen
  // Sommerzeit vor 2 Uhr den Vortag.
  const monat = String(date.getMonth() + 1).padStart(2, '0');
  const tag = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${monat}-${tag}`;
}
