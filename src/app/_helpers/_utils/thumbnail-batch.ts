import { League } from '@floorball/types';
import {
  CompetitionKey,
  competitionKey,
  leagueMarkUrl,
} from './competition-theme';
import {
  ThumbnailInput,
  ThumbnailResult,
  filenameSlug,
  renderThumbnailPng,
  thumbnailDateLine,
} from './stream-thumbnail';
import { ZipEntry } from './zip-store';

/**
 * Was der Stapel aus einem Spiel liest.
 *
 * Absichtlich weniger als `Game`: Der Spieltagsabruf der Verwaltung liefert
 * `Game#meta_hash`, und darin steht weder `league_name` noch `date` noch
 * `arena_name`. Stünde hier `Game`, sähe ein Rückfall auf eines dieser Felder
 * richtig aus und wäre zur Laufzeit `undefined` -- genau der Fehler, der in der
 * ersten Fassung des Stapels steckte.
 */
export interface ThumbnailBatchGame {
  start_time: string;
  home_team_name: string;
  guest_team_name: string;
  home_team_logo?: string | null;
  home_team_small_logo?: string | null;
  guest_team_logo?: string | null;
  guest_team_small_logo?: string | null;
}

/**
 * Der Spieltag als Ganzes, EIN Eingang statt vier.
 *
 * Die Angaben (Liga, Nummer, Datum, Halle) gehören zusammen, und an den
 * Aufrufstellen kommen sie ohnehin aus einem Objekt. Getrennt übergeben ließen
 * sie sich mischen -- Spiele der einen Liga mit der Kennung einer anderen, das
 * Datum eines fremden Spieltags --, und das Bild trüge die falsche Wortmarke,
 * ohne dass irgendwo ein Fehler erschiene.
 */
export interface ThumbnailBatchGameDay {
  number: number;
  /** Spieltagsdatum als `YYYY-MM-DD`; alles andere ergibt eine Fußzeile ohne Datum. */
  date: string;
  league_id: number;
  arena?: { name?: string | null } | null;
}

/**
 * Ein Spieltag samt seiner Spiele -- die Form, in der ihn der Ligaspielplan
 * liefert (`GamedayWithGames`) und in der der Knopf je Spieltag ihn bekommt.
 * Der Streaming-Bereich hat diese Form nicht: Dort steht eine Auswahl einzelner
 * Spiele, jedes mit seinem eigenen Spieltag.
 */
export interface ThumbnailBatchGameDayWithGames extends ThumbnailBatchGameDay {
  games: ThumbnailBatchGame[];
}

/**
 * Ein Bild des Stapels: das Spiel und der Spieltag, aus dem Datum und Halle
 * kommen.
 *
 * Zusammen und nicht als zwei Listen, weil ein Stapel seit dem Streaming-Bereich
 * über MEHRERE Spieltage und sogar mehrere Ligen gehen kann -- ein Wochenende
 * quer über die Bundesligen. Der Spieltag je Spiel ist dann keine Konstante
 * mehr, sondern eine Eigenschaft der Zeile.
 */
export interface ThumbnailBatchItem {
  game: ThumbnailBatchGame;
  gameDay: ThumbnailBatchGameDay;
}

export interface ThumbnailBatchHooks {
  /**
   * Die Liga zu einer Kennung, oder `null`, wenn sie sich nicht laden ließ.
   *
   * Der Aufrufer hält den Zwischenspeicher: Er weiß, ob sein Stapel eine oder
   * vier Ligen umfasst, und ob ein Fehlschlag behalten werden darf.
   */
  league(leagueId: number): Promise<League | null>;
  /** Nach jedem Spiel, für die Anzeige „3 von 6". */
  progress(done: number): void;
  /** Ein Fehler, der nicht die Oberfläche erreicht, aber nach Sentry gehört. */
  capture(error: unknown, item?: ThumbnailBatchItem): void;
  /** True, sobald die Ansicht weg ist -- der Stapel bricht dann ab. */
  cancelled(): boolean;
}

export interface ThumbnailBatchOutcome {
  entries: ZipEntry[];
  report: ThumbnailBatchReport;
  /** True, wenn abgebrochen wurde, weil die Ansicht verschwand. */
  aborted: boolean;
}

/**
 * Zeichnet die Bilder eines Stapels und gibt sie als ZIP-Einträge zurück.
 *
 * DIE EINZIGE STAPEL-SCHLEIFE. Gezeichnet wird mit `renderThumbnailPng`, also
 * demselben Code wie das einzelne Bild im Spielbericht; und diese Funktion ist
 * der einzige Weg, es für mehrere Spiele zu tun. Zwei Schleifen nebeneinander
 * (eine im Spielplan, eine im Streaming-Bereich) liefen unweigerlich
 * auseinander, und der Unterschied fiele erst auf YouTube auf.
 *
 * Nacheinander und nicht mit `Promise.all`: Jedes Bild lädt zwei Wappen und ein
 * Ligazeichen, parallel wären das bei sechs Spielen achtzehn gleichzeitige
 * Abrufe an denselben Server. Der Zeitgewinn wäre gering (das Ligazeichen ist je
 * Liga dasselbe und liegt ab dem zweiten Bild im Zwischenspeicher des Browsers),
 * der Fortschritt aber nicht mehr anzeigbar.
 */
export async function renderThumbnailBatch(
  items: ThumbnailBatchItem[],
  hooks: ThumbnailBatchHooks
): Promise<ThumbnailBatchOutcome> {
  const report = new ThumbnailBatchReport();
  const entries: ZipEntry[] = [];

  for (const [index, item] of items.entries()) {
    // Nach jedem `await` kann die Ansicht zerstört worden sein.
    if (hooks.cancelled()) return { entries, report, aborted: true };

    try {
      const league = await hooks.league(item.gameDay.league_id);
      if (!league) report.recordLeagueMissing(item.gameDay.league_id);

      const input = thumbnailInput(item, league);
      const { blob, result } = await renderThumbnailPng(input);

      entries.push({
        name: entryName(item, index, input),
        data: new Uint8Array(await blob.arrayBuffer()),
      });
      report.recordRendered(item.game, result);
    } catch (error) {
      // Ein einzelnes Spiel darf den Stapel nicht abbrechen: Fünf von sechs
      // Bildern sind fünf gesparte Runden, und welches fehlt, steht in der
      // Meldung.
      hooks.capture(error, item);
      report.recordFailure(item.game);
    }

    hooks.progress(index + 1);
  }

  return { entries, report, aborted: false };
}

export function thumbnailInput(
  item: ThumbnailBatchItem,
  league: League | null
): ThumbnailInput {
  const competition: CompetitionKey = competitionKey(league);

  return {
    variant: 'livestream',
    // Ohne Liga bleibt die Kopfzeile leer. Einen Rückfall auf das Spiel gibt es
    // nicht: `meta_hash` nennt die Liga nicht, siehe `ThumbnailBatchGame`.
    leagueName: league?.name ?? '',
    competition,
    markUrl: leagueMarkUrl(league, competition),
    home: {
      // Vor der Auslosung einer K.-o.-Runde steht die Mannschaft noch nicht
      // fest. Der Stream wird trotzdem vorher eingerichtet, also gibt es ein
      // Bild mit Platzhalter statt keines.
      name: item.game.home_team_name || 'N.N.',
      logoUrl: item.game.home_team_logo || item.game.home_team_small_logo,
    },
    guest: {
      name: item.game.guest_team_name || 'N.N.',
      logoUrl: item.game.guest_team_logo || item.game.guest_team_small_logo,
    },
    // Datum und Halle kommen vom Spieltag und nicht vom Spiel -- ein Spiel hat
    // keine eigene Datumsspalte.
    dateLine: thumbnailDateLine(
      item.gameDay.date,
      item.game.start_time,
      'livestream'
    ),
    venue: item.gameDay.arena?.name || null,
  };
}

/**
 * Name im Archiv, etwa
 * `spieltag-3-2026-10-12/01-18-00-uhc-sparkasse-weissenfels-mfbc-grimma.png`.
 *
 * Ein Ordner je Spieltag, damit das Auspacken nicht sechs Bilder frei in den
 * Download-Ordner streut -- und damit ein Stapel über ein ganzes Wochenende
 * nach Spieltagen getrennt ankommt statt als ein Haufen.
 *
 * Die laufende Nummer steht vorn, damit die Dateisortierung der Reihenfolge des
 * Spieltags entspricht: Danach werden die Streams angelegt. Die Spielnummer
 * taugt dafür nicht -- sie ist Text, in K.-o.-Runden auch mal „HF1", und
 * alphabetisch sortiert stünde „1000" vor „999". Sie ist zugleich der Schutz vor
 * zwei gleichen Namen: Zwei lange Vereinsnamen können sich auf 40 Zeichen
 * gekürzt gleichen, und ein doppelter Name wird von `buildZip` abgewiesen.
 * Deshalb ist es die Nummer im ganzen Stapel und nicht die im Ordner.
 */
export function entryName(
  item: ThumbnailBatchItem,
  index: number,
  input: ThumbnailInput
): string {
  const parts = [
    String(index + 1).padStart(2, '0'),
    filenameSlug(item.game.start_time || '') || 'ohne-zeit',
    filenameSlug(input.home.name),
    filenameSlug(input.guest.name),
  ];

  return `${folderName(item.gameDay)}/${parts.join('-')}.png`;
}

export function folderName(gameDay: ThumbnailBatchGameDay): string {
  return (
    [
      gameDay.number ? `spieltag-${gameDay.number}` : '',
      filenameSlug(gameDay.date || ''),
    ]
      .filter(Boolean)
      .join('-') || 'spieltag'
  );
}

export function pairing(game: ThumbnailBatchGame): string {
  return `${game.home_team_name || 'N.N.'} – ${game.guest_team_name || 'N.N.'}`;
}

/**
 * Sammelt, was an den fertigen Bildern nicht stimmt, und fasst es zu EINER
 * Meldung samt Stufe zusammen.
 *
 * Eigene Klasse, weil hier zwei Dinge zusammenkommen, die getrennt nichts
 * aussagen: Bei einem einzelnen Bild steht der Hinweis neben der Vorschau, die
 * man ohnehin ansieht. Im Stapel sieht niemand die sechs Bilder an -- was fehlt,
 * muss also benannt werden, und zwar mit dem Spiel, sonst prüft man sechs
 * Dateien, um die eine zu finden.
 *
 * EIN AUSGANG FÜR DEN ERFOLGSFALL: `result()` gibt Text und Stufe zusammen aus.
 * Getrennt liefen die beiden auseinander, und in der ersten Fassung taten sie es
 * -- ein Durchgang ohne Ligadaten wurde als grüner Erfolg gemeldet, mit dem
 * Problemsatz mitten darin. `problems()` ist daneben absichtlich öffentlich: Wenn
 * gar kein Bild entstanden ist, gibt es keinen Erfolgsfall, und die
 * Fehlermeldung braucht die Beanstandungen ohne Kopfzeile.
 */
export class ThumbnailBatchReport {
  // Je Liga nur einmal: Ein Stapel über vier Ligen, von denen eine nicht lädt,
  // soll den Satz einmal sagen und nicht viermal.
  private _leaguesMissing = new Set<number>();
  private _missingCrest: string[] = [];
  private _missingMark = false;
  private _fallbackFonts = false;
  private _failed: string[] = [];

  public recordLeagueMissing(leagueId: number): void {
    this._leaguesMissing.add(leagueId);
  }

  public recordRendered(
    game: ThumbnailBatchGame,
    result: ThumbnailResult
  ): void {
    if (result.missing.includes('home') || result.missing.includes('guest')) {
      this._missingCrest.push(pairing(game));
    }
    if (result.missing.includes('mark')) this._missingMark = true;
    if (!result.fontsLoaded) this._fallbackFonts = true;
  }

  public recordFailure(game: ThumbnailBatchGame): void {
    this._failed.push(pairing(game));
  }

  /** Nur die Beanstandungen, ohne Kopfzeile. Leer, wenn alles stimmte. */
  public problems(): string {
    const notes: string[] = [];

    if (this._failed.length) {
      notes.push(
        `Nicht erzeugt: ${this._failed.join(', ')}. Diese Bilder lassen sich einzeln in der Spielansicht holen.`
      );
    }

    if (this._leaguesMissing.size) {
      notes.push(
        this._leaguesMissing.size === 1
          ? 'Die Ligadaten ließen sich nicht laden: Die Bilder tragen deshalb weder Liganamen noch Ligazeichen und Ligafarben.'
          : `Die Ligadaten ließen sich für ${this._leaguesMissing.size} Ligen nicht laden: Deren Bilder tragen weder Liganamen noch Ligazeichen und Ligafarben.`
      );
    } else if (this._missingMark) {
      notes.push('Das Ligazeichen ließ sich nicht laden.');
    }

    if (this._missingCrest.length) {
      notes.push(
        `Ein Vereinswappen fehlt bei: ${this._missingCrest.join(', ')}. Dort steht das Kürzel.`
      );
    }

    if (this._fallbackFonts) {
      notes.push(
        'Die Schriften ließen sich nicht laden, die Bilder weichen deshalb von den Overlays ab.'
      );
    }

    return notes.join(' ');
  }

  public result(
    written: number,
    total: number
  ): { level: 'success' | 'warning'; text: string } {
    const head =
      written === total
        ? `${written} ${written === 1 ? 'Thumbnail' : 'Thumbnails'} als ZIP gespeichert.`
        : `${written} von ${total} Thumbnails als ZIP gespeichert.`;
    const problems = this.problems();

    return {
      level: problems ? 'warning' : 'success',
      text: problems ? `${head} ${problems}` : head,
    };
  }
}
