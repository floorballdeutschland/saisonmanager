import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
} from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import * as Sentry from '@sentry/angular';
import { LeagueService, NotificationService } from '@floorball/core';
import { Game, League } from '@floorball/types';
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
 * Alle Livestream-Thumbnails eines Spieltags in einem Archiv.
 *
 * WOFÜR: Die Übertragungen der Bundesligen richtet eine Stelle zentral auf
 * YouTube ein, nicht der jeweilige Verein. Dort wird pro Spiel ein Stream
 * angelegt und ein Thumbnail hochgeladen. Einzeln geholt heißt das: je Spiel
 * die Spielansicht öffnen, warten, herunterladen -- bei einem Spieltag mit sechs
 * Partien sechs Runden durch die Oberfläche. Ein Archiv macht daraus einen Klick.
 *
 * Gezeichnet wird derselbe Bildaufbau wie im Spielbericht, mit demselben Code
 * (`renderThumbnailPng`). Das ist der Grund, warum diese Komponente das Bild
 * nicht selbst malt: Zwei Zeichenwege liefen unweigerlich auseinander, und der
 * Unterschied fiele erst auf YouTube auf.
 *
 * NUR DER BILDAUFBAU „livestream": Das Highlight-Bild trägt den Endstand und
 * ist damit erst nach dem Spiel sinnvoll, der Stapel wird aber vorher gebraucht.
 * Nach dem Spiel holt man das einzelne Bild dort, wo das Ergebnis steht.
 */
@Component({
  selector: 'fb-thumbnail-batch',
  templateUrl: './thumbnail-batch.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ThumbnailBatchComponent {
  /** Die Spiele des Spieltags, in der Reihenfolge, in der sie angezeigt werden. */
  @Input()
  games: Game[] = [];

  @Input()
  leagueId?: number | null;

  @Input()
  gameDayNumber?: number | null;

  /** Spieltagsdatum (`YYYY-MM-DD`). Steht im Bild und im Namen des Archivs. */
  @Input()
  date?: string | null;

  /** Halle, zweite Fußzeile im Bild. */
  @Input()
  arenaName?: string | null;

  public busy = false;
  /** Fertige Bilder des laufenden Durchgangs, für die Anzeige „3 von 6". */
  public done = 0;

  // Ohne Spiele gibt es nichts zu holen. Das Ausblenden gehört an die
  // Komponente: Sie sitzt in einer Knopfreihe, ein untätiger Knopf dort führte
  // nur in eine Fehlermeldung.
  @HostBinding('class.hidden')
  public get hidden(): boolean {
    return !this.games?.length;
  }

  private _league: League | null = null;
  private _leagueLoaded = false;

  constructor(
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  public get total(): number {
    return this.games?.length ?? 0;
  }

  /**
   * Zeichnet alle Bilder und legt sie als ZIP in den Download-Ordner.
   *
   * Nacheinander und nicht mit `Promise.all`: Jedes Bild lädt zwei Wappen und
   * ein Ligazeichen, parallel wären das bei sechs Spielen achtzehn gleichzeitige
   * Abrufe an denselben Server. Der Zeitgewinn wäre gering (die Wappen liegen ab
   * dem zweiten Spiel im Zwischenspeicher des Browsers), der Fortschritt aber
   * nicht mehr anzeigbar.
   */
  public async download(): Promise<void> {
    if (this.busy || !this.games?.length) return;

    this.busy = true;
    this.done = 0;
    this._cdr.markForCheck();

    const league = await this._league$();
    const competition = competitionKey(league);
    const markUrl = leagueMarkUrl(league, competition);

    const entries: ZipEntry[] = [];
    const notes = new ThumbnailNotes();

    for (const [index, game] of this.games.entries()) {
      const input = this._input(game, league, competition, markUrl);

      try {
        const { blob, result } = await renderThumbnailPng(input);

        entries.push({
          name: this._entryName(index, game, input),
          data: new Uint8Array(await blob.arrayBuffer()),
        });
        notes.add(game, result);
      } catch (error) {
        // Ein einzelnes Spiel darf den Stapel nicht abbrechen: Fünf von sechs
        // Bildern sind fünf gesparte Runden, und welches fehlt, steht in der
        // Meldung.
        Sentry.captureException(error);
        notes.fail(game);
      }

      this.done = index + 1;
      this._cdr.markForCheck();
    }

    this._finish(entries, league, notes);

    this.busy = false;
    this._cdr.markForCheck();
  }

  private _finish(
    entries: ZipEntry[],
    league: League | null,
    notes: ThumbnailNotes
  ): void {
    if (!entries.length) {
      this._notificationService.error(
        'Es ließ sich kein einziges Thumbnail erzeugen. Bitte die Seite neu laden und noch einmal versuchen.'
      );
      return;
    }

    try {
      saveBlob(buildZip(entries), this._zipName(league));
    } catch (error) {
      // Bis hierher sind alle Bilder fertig; scheitert erst das Verpacken oder
      // das Ablegen, liegt trotzdem keine Datei im Ordner. Ohne Meldung sucht
      // man sie dort vergeblich.
      Sentry.captureException(error);
      this._notificationService.error(
        'Die Bilder ließen sich nicht als Archiv speichern.'
      );
      return;
    }

    const summary = notes.summary(league, entries.length, this.total);

    if (notes.hasProblems) {
      this._notificationService.warning(summary);
    } else {
      this._notificationService.success(summary);
    }
  }

  /**
   * Die Liga, einmal geholt und behalten.
   *
   * Sie trägt Ligazeichen und Farbwelt, und beides steht in keinem Spielabruf.
   * Der Abruf ist der öffentliche und liefert bei einem Fehlschlag `null`: Dann
   * steht die Paarung im neutralen Bild, und die Meldung am Ende sagt das --
   * ganz ohne Bilder dastehen wäre die schlechtere Antwort.
   */
  private async _league$(): Promise<League | null> {
    if (this._leagueLoaded || !this.leagueId) return this._league;

    this._league = await firstValueFrom(
      this._leagueService
        .getSingleLeague(this.leagueId)
        .pipe(catchError(() => of(null)))
    );
    this._leagueLoaded = true;

    return this._league;
  }

  private _input(
    game: Game,
    league: League | null,
    competition: CompetitionKey,
    markUrl: string | null
  ): ThumbnailInput {
    return {
      variant: 'livestream',
      competition,
      leagueName: league?.name || game.league_name || '',
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
      dateLine: thumbnailDateLine(this.date, game.start_time),
      venue: this.arenaName || null,
    };
  }

  /**
   * Name im Archiv, etwa `01-18-00-uhc-sparkasse-weissenfels-mfbc-leipzig.png`.
   *
   * Die laufende Nummer steht vorn, damit die Dateisortierung im Ordner der
   * Reihenfolge des Spieltags entspricht: Danach werden die Streams angelegt.
   * Die Spielnummer taugt dafür nicht -- sie ist Text, in K.-o.-Runden auch mal
   * „HF1", und alphabetisch sortiert stünde „1000" vor „999".
   */
  private _entryName(index: number, game: Game, input: ThumbnailInput): string {
    const parts = [
      String(index + 1).padStart(2, '0'),
      filenameSlug(game.start_time || '') || 'ohne-zeit',
      filenameSlug(input.home.name),
      filenameSlug(input.guest.name),
    ].filter(Boolean);

    return `${parts.join('-')}.png`;
  }

  private _zipName(league: League | null): string {
    const parts = [
      'thumbnails',
      filenameSlug(league?.name || ''),
      this.gameDayNumber ? `spieltag-${this.gameDayNumber}` : '',
      filenameSlug(this.date || ''),
    ].filter(Boolean);

    return `${parts.join('-')}.zip`;
  }
}

/**
 * Sammelt, was an den fertigen Bildern nicht stimmt, und fasst es zu EINER
 * Meldung zusammen.
 *
 * Eigene Klasse, weil hier zwei Dinge zusammenkommen, die getrennt nichts
 * aussagen: Bei einem einzelnen Bild steht der Hinweis neben der Vorschau, die
 * man ohnehin ansieht. Im Stapel sieht niemand die sechs Bilder an -- was fehlt,
 * muss also benannt werden, und zwar mit dem Spiel, sonst prüft man sechs
 * Dateien, um die eine zu finden.
 */
class ThumbnailNotes {
  private _missingCrest: string[] = [];
  private _missingMark = false;
  private _fallbackFonts = false;
  private _failed: string[] = [];

  public get hasProblems(): boolean {
    return Boolean(
      this._missingCrest.length ||
      this._missingMark ||
      this._fallbackFonts ||
      this._failed.length
    );
  }

  public add(game: Game, result: ThumbnailResult): void {
    if (result.missing.includes('home') || result.missing.includes('guest')) {
      this._missingCrest.push(pairing(game));
    }
    if (result.missing.includes('mark')) this._missingMark = true;
    if (!result.fontsLoaded) this._fallbackFonts = true;
  }

  public fail(game: Game): void {
    this._failed.push(pairing(game));
  }

  public summary(
    league: League | null,
    written: number,
    total: number
  ): string {
    const notes: string[] = [
      written === total
        ? `${written} ${written === 1 ? 'Thumbnail' : 'Thumbnails'} als ZIP gespeichert.`
        : `${written} von ${total} Thumbnails als ZIP gespeichert.`,
    ];

    if (this._failed.length) {
      notes.push(`Nicht erzeugt: ${this._failed.join(', ')}.`);
    }

    if (!league) {
      notes.push(
        'Die Ligadaten ließen sich nicht laden: Die Bilder tragen deshalb weder Ligazeichen noch Ligafarben.'
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
}

function pairing(game: Game): string {
  return `${game.home_team_name || 'N.N.'} – ${game.guest_team_name || 'N.N.'}`;
}
