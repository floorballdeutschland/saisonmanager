import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  OnDestroy,
} from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import * as Sentry from '@sentry/angular';
import { LeagueService, NotificationService } from '@floorball/core';
import { League } from '@floorball/types';
import {
  CompetitionKey,
  competitionKey,
  leagueMarkUrl,
} from 'src/app/_helpers/_utils/competition-theme';
import {
  ThumbnailInput,
  ThumbnailResult,
  filenameSlug,
  renderThumbnailPng,
  saveBlob,
  thumbnailDateLine,
} from 'src/app/_helpers/_utils/stream-thumbnail';
import { ZipEntry, buildZip } from 'src/app/_helpers/_utils/zip-store';

/**
 * Was der Stapel aus einem Spiel liest.
 *
 * Absichtlich weniger als `Game`: Der Spieltagsabruf der Verwaltung liefert
 * `Game#meta_hash`, und darin steht weder `league_name` noch `date` noch
 * `arena_name`. Stünde hier `Game`, sähe ein Rückfall auf eines dieser Felder
 * richtig aus und wäre zur Laufzeit `undefined` -- genau der Fehler, der in der
 * ersten Fassung dieser Komponente steckte.
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
 * Der Spieltag als Ganzes, EIN Eingang statt fünf.
 *
 * Die fünf Angaben (Spiele, Liga, Nummer, Datum, Halle) gehören zusammen, und
 * an der Aufrufstelle kommen sie ohnehin aus einem Objekt: `GamedayWithGames`
 * erfüllt diese Form ohne Umweg. Getrennt übergeben ließen sie sich mischen --
 * Spiele der einen Liga mit der Kennung einer anderen, das Datum eines fremden
 * Spieltags --, und das Bild trüge die falsche Wortmarke, ohne dass irgendwo
 * ein Fehler erschiene.
 */
export interface ThumbnailBatchGameDay {
  number: number;
  /** Spieltagsdatum als `YYYY-MM-DD`; alles andere ergibt eine Fußzeile ohne Datum. */
  date: string;
  league_id: number;
  arena?: { name?: string | null } | null;
  games: ThumbnailBatchGame[];
}

/**
 * Alle Livestream-Thumbnails eines Spieltags in einem Archiv.
 *
 * WOFÜR: Die Übertragungen der Bundesligen richtet eine Stelle zentral auf
 * YouTube ein, nicht der jeweilige Verein. Dort wird pro Spiel ein Stream
 * angelegt und ein Thumbnail hochgeladen. Einzeln geholt heißt das: je Spiel
 * die Spielansicht öffnen, warten, herunterladen -- bei einem Spieltag mit sechs
 * Partien sechs Runden durch die Oberfläche. Ein Archiv macht daraus einen Klick.
 *
 * Gezeichnet wird derselbe Bildaufbau wie im Spielbericht, und zwar von
 * demselben Code: `renderStreamThumbnail`, hier über die Hülle
 * `renderThumbnailPng`, die eine frei stehende Leinwand mitbringt. Das ist der
 * Grund, warum diese Komponente das Bild nicht selbst malt -- zwei Zeichenwege
 * liefen unweigerlich auseinander, und der Unterschied fiele erst auf YouTube
 * auf.
 *
 * NUR DER BILDAUFBAU „livestream": Das Highlight-Bild trägt den Endstand und
 * ist damit erst nach dem Spiel sinnvoll, der Stapel wird aber vorher gebraucht.
 * Nach dem Spiel holt man das einzelne Bild dort, wo das Ergebnis steht.
 *
 * DEUTSCH UND NICHT ÜBERSETZT: bewusst, wie in der ganzen Streaming-Familie
 * (`fb-overlay-links`, `fb-stream-graphics`, die OBS-Szenensammlung). Die
 * Nachbarknöpfe im Spielplan sind übersetzt; wer diese Komponente in eine
 * Ansicht mit englischer Oberfläche stellt, sollte den Scope nachziehen.
 */
@Component({
  selector: 'fb-thumbnail-batch',
  templateUrl: './thumbnail-batch.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ThumbnailBatchComponent implements OnDestroy {
  @Input({ required: true })
  gameDay!: ThumbnailBatchGameDay;

  public busy = false;
  /**
   * Bearbeitete Spiele, für die Anzeige „3 von 6". Ein Fehlschlag zählt mit:
   * Sonst bliebe der Fortschritt bei einem kaputten Bild stehen und sähe aus
   * wie ein Stillstand. Wie viele Bilder wirklich entstanden sind, sagt die
   * Meldung am Ende.
   */
  public done = 0;

  // Ohne Spiele gibt es nichts zu holen. Das Ausblenden gehört an die
  // Komponente: Sie sitzt in einer Knopfreihe, ein untätiger Knopf dort führte
  // nur in eine Fehlermeldung.
  @HostBinding('class.hidden')
  public get hidden(): boolean {
    return !this.gameDay?.games?.length;
  }

  private _league: League | null = null;
  private _leagueLoaded = false;
  private _destroyed = false;

  constructor(
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  public get total(): number {
    return this.gameDay?.games?.length ?? 0;
  }

  // Der Spielplan baut seine Spieltage bei jedem Neuladen neu und zerstört die
  // Komponente dabei. Ohne diesen Riegel liefe die Schleife auf der zerstörten
  // Ansicht weiter und legte am Ende ein Archiv im Download-Ordner ab, das
  // niemand mehr angefordert hat -- samt Meldung auf einer anderen Seite.
  public ngOnDestroy(): void {
    this._destroyed = true;
  }

  /**
   * Zeichnet alle Bilder und legt sie als ZIP in den Download-Ordner.
   *
   * Nacheinander und nicht mit `Promise.all`: Jedes Bild lädt zwei Wappen und
   * ein Ligazeichen, parallel wären das bei sechs Spielen achtzehn gleichzeitige
   * Abrufe an denselben Server. Der Zeitgewinn wäre gering (das Ligazeichen ist
   * für alle Spiele dasselbe und liegt ab dem zweiten im Zwischenspeicher des
   * Browsers), der Fortschritt aber nicht mehr anzeigbar.
   */
  public async download(): Promise<void> {
    if (this.busy || !this.gameDay?.games?.length) return;

    this.busy = true;
    this.done = 0;
    this._cdr.markForCheck();

    const report = new ThumbnailBatchReport();

    try {
      const league = await this._league$(report);
      const competition = competitionKey(league);
      const markUrl = leagueMarkUrl(league, competition);
      const entries: ZipEntry[] = [];

      for (const [index, game] of this.gameDay.games.entries()) {
        // Nach jedem `await` kann die Komponente zerstört worden sein.
        if (this._destroyed) return;

        try {
          const input = this._input(game, league, competition, markUrl);
          const { blob, result } = await renderThumbnailPng(input);

          entries.push({
            name: this._entryName(index, game, input),
            data: new Uint8Array(await blob.arrayBuffer()),
          });
          report.recordRendered(game, result);
        } catch (error) {
          // Ein einzelnes Spiel darf den Stapel nicht abbrechen: Fünf von sechs
          // Bildern sind fünf gesparte Runden, und welches fehlt, steht in der
          // Meldung.
          this._capture(error, game);
          report.recordFailure(game);
        }

        this.done = index + 1;
        this._cdr.markForCheck();
      }

      this._finish(entries, league, report);
    } catch (error) {
      // Alles außerhalb der Spiel-Schleife: der Ligaabruf, das Verpacken, ein
      // Programmierfehler. Ohne diesen Riegel bliebe `busy` hängen und der
      // Knopf stünde bis zum Neuladen auf „wird erzeugt", ohne jede Meldung.
      this._capture(error);
      this._notificationService.error(
        'Der Stapel ist unerwartet abgebrochen. Bitte die Seite neu laden und noch einmal versuchen.',
        { keepAfterRouteChange: true }
      );
    } finally {
      this.busy = false;
      this._cdr.markForCheck();
    }
  }

  private _finish(
    entries: ZipEntry[],
    league: League | null,
    report: ThumbnailBatchReport
  ): void {
    if (!entries.length) {
      // Was schon erfasst ist, gehört auch in die Fehlermeldung: Die Ursache
      // (Rechte, Wappen, Schriften) steht in `report`, und ohne sie liest der
      // Benutzer nur „hat nicht geklappt".
      this._notificationService.error(
        `Es ließ sich kein einziges Thumbnail erzeugen. ${report.problems()}`.trim(),
        { keepAfterRouteChange: true }
      );
      return;
    }

    try {
      saveBlob(buildZip(entries), this._zipName(league));
    } catch (error) {
      // Bis hierher sind alle Bilder fertig; scheitert erst das Verpacken oder
      // das Ablegen, liegt trotzdem keine Datei im Ordner. Der Grund von
      // `buildZip` ist bereits ein deutscher Satz und wird deshalb
      // durchgereicht statt verworfen.
      this._capture(error);
      this._notificationService.error(
        `Die Bilder ließen sich nicht als Archiv speichern. ${
          error instanceof Error ? error.message : ''
        }`.trim(),
        { keepAfterRouteChange: true }
      );
      return;
    }

    const { level, text } = report.result(entries.length, this.total);
    this._notificationService[level](text, { keepAfterRouteChange: true });
  }

  /**
   * Die Liga, einmal geholt und behalten.
   *
   * Sie trägt Ligazeichen und Farbwelt, und beides steht in keinem Spielabruf.
   * Ein Fehlschlag liefert `null`: Dann steht die Paarung im neutralen Bild, und
   * die Meldung am Ende sagt das -- ganz ohne Bilder dastehen wäre die
   * schlechtere Antwort. Er wird aber NICHT behalten (`_leagueLoaded` nur im
   * Erfolgsfall), sonst lieferte ein zweiter Klick nach einem kurzen
   * Netzproblem stillschweigend wieder neutrale Bilder.
   *
   * Der Fehler geht an Sentry, obwohl er die Oberfläche nicht aufhält: Es ist
   * der einzige Serverabruf dieses Wegs, und ein dauerhaft nicht erreichbarer
   * Ligaabruf erzeugt sonst beliebig lange Bilder ohne Wortmarke, ohne dass es
   * jemand erfährt.
   */
  private async _league$(report: ThumbnailBatchReport): Promise<League | null> {
    if (this._leagueLoaded) return this._league;

    const league = await firstValueFrom(
      this._leagueService.getSingleLeague(this.gameDay.league_id).pipe(
        catchError((error) => {
          this._capture(error);
          return of(null);
        })
      )
    );

    if (league) {
      this._league = league;
      this._leagueLoaded = true;
    } else {
      report.recordLeagueMissing();
    }

    return league;
  }

  private _input(
    game: ThumbnailBatchGame,
    league: League | null,
    competition: CompetitionKey,
    markUrl: string | null
  ): ThumbnailInput {
    return {
      variant: 'livestream',
      // Ohne Liga bleibt die Kopfzeile leer. Ein Rückfall auf das Spiel gibt es
      // nicht: `meta_hash` nennt die Liga nicht, siehe `ThumbnailBatchGame`.
      leagueName: league?.name ?? '',
      competition,
      markUrl,
      home: {
        // Vor der Auslosung einer K.-o.-Runde steht die Mannschaft noch nicht
        // fest. Der Stream wird trotzdem vorher eingerichtet, also gibt es ein
        // Bild mit Platzhalter statt keines.
        name: game.home_team_name || 'N.N.',
        logoUrl: game.home_team_logo || game.home_team_small_logo,
      },
      guest: {
        name: game.guest_team_name || 'N.N.',
        logoUrl: game.guest_team_logo || game.guest_team_small_logo,
      },
      // Datum und Halle kommen vom Spieltag und nicht vom Spiel -- ein Spiel
      // hat keine eigene Datumsspalte, `Game#schedule_item` gibt für den
      // Einzelweg dieselbe Angabe des Spieltags aus.
      dateLine: thumbnailDateLine(
        this.gameDay.date,
        game.start_time,
        'livestream'
      ),
      venue: this.gameDay.arena?.name || null,
    };
  }

  /**
   * Name im Archiv, etwa
   * `spieltag-3-2026-10-12/01-18-00-uhc-sparkasse-weissenfels-mfbc-grimma.png`.
   *
   * Ein Ordner, damit das Auspacken nicht sechs Bilder frei in den
   * Download-Ordner streut. Die laufende Nummer steht vorn, damit die
   * Dateisortierung im Ordner der Reihenfolge des Spieltags entspricht: Danach
   * werden die Streams angelegt. Die Spielnummer taugt dafür nicht -- sie ist
   * Text, in K.-o.-Runden auch mal „HF1", und alphabetisch sortiert stünde
   * „1000" vor „999". Sie ist zugleich der Schutz vor zwei gleichen Namen: Zwei
   * lange Vereinsnamen können sich auf 40 Zeichen gekürzt gleichen, und ein
   * doppelter Name wird von `buildZip` abgewiesen.
   */
  private _entryName(
    index: number,
    game: ThumbnailBatchGame,
    input: ThumbnailInput
  ): string {
    const parts = [
      String(index + 1).padStart(2, '0'),
      filenameSlug(game.start_time || '') || 'ohne-zeit',
      filenameSlug(input.home.name),
      filenameSlug(input.guest.name),
    ];

    return `${this._folderName()}/${parts.join('-')}.png`;
  }

  private _folderName(): string {
    return (
      [
        this.gameDay.number ? `spieltag-${this.gameDay.number}` : '',
        filenameSlug(this.gameDay.date || ''),
      ]
        .filter(Boolean)
        .join('-') || 'spieltag'
    );
  }

  private _zipName(league: League | null): string {
    const parts = [
      'thumbnails',
      filenameSlug(league?.name || ''),
      this._folderName(),
    ].filter(Boolean);

    return `${parts.join('-')}.zip`;
  }

  /**
   * Ein Vorfall in Sentry ohne Angabe des Spieltags ist nicht auswertbar --
   * Frontend und Rails-API teilen sich dort ein Projekt, und „Das Bild konnte
   * nicht erzeugt werden." allein sagt niemandem etwas.
   */
  private _capture(error: unknown, game?: ThumbnailBatchGame): void {
    Sentry.captureException(error, {
      tags: { feature: 'thumbnail-batch' },
      extra: {
        leagueId: this.gameDay?.league_id,
        gameDayNumber: this.gameDay?.number,
        gameDayDate: this.gameDay?.date,
        pairing: game ? pairing(game) : undefined,
      },
    });
  }
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
 * EIN Ausgang: Wer den Text bekommt, bekommt die Stufe dazu. Getrennt liefen
 * die beiden auseinander, und in der ersten Fassung taten sie es -- ein
 * Durchgang ohne Ligadaten wurde als grüner Erfolg gemeldet, mit dem
 * Problemsatz mitten darin.
 */
class ThumbnailBatchReport {
  private _leagueMissing = false;
  private _missingCrest: string[] = [];
  private _missingMark = false;
  private _fallbackFonts = false;
  private _failed: string[] = [];

  public recordLeagueMissing(): void {
    this._leagueMissing = true;
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

    if (this._leagueMissing) {
      notes.push(
        'Die Ligadaten ließen sich nicht laden: Die Bilder tragen deshalb weder Liganamen noch Ligazeichen und Ligafarben.'
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

function pairing(game: ThumbnailBatchGame): string {
  return `${game.home_team_name || 'N.N.'} – ${game.guest_team_name || 'N.N.'}`;
}
