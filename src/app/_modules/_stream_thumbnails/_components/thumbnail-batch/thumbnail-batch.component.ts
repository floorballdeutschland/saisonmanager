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
  filenameSlug,
  saveBlob,
} from 'src/app/_helpers/_utils/stream-thumbnail';
import {
  ThumbnailBatchGameDayWithGames,
  ThumbnailBatchItem,
  ThumbnailBatchReport,
  folderName,
  pairing,
  renderThumbnailBatch,
} from 'src/app/_helpers/_utils/thumbnail-batch';
import { ZipEntry, buildZip } from 'src/app/_helpers/_utils/zip-store';

export {
  ThumbnailBatchGame,
  ThumbnailBatchGameDay,
  ThumbnailBatchGameDayWithGames,
} from 'src/app/_helpers/_utils/thumbnail-batch';

/**
 * Alle Livestream-Thumbnails eines Spieltags in einem Archiv.
 *
 * WOFÜR: Die Übertragungen der Bundesligen richtet eine Stelle zentral auf
 * YouTube ein, nicht der jeweilige Verein. Dort wird pro Spiel ein Stream
 * angelegt und ein Thumbnail hochgeladen. Einzeln geholt heißt das: je Spiel
 * die Spielansicht öffnen, warten, herunterladen -- bei einem Spieltag mit sechs
 * Partien sechs Runden durch die Oberfläche. Ein Archiv macht daraus einen Klick.
 *
 * Diese Komponente ist der Knopf für EINEN Spieltag; die Schleife selbst steht
 * in `renderThumbnailBatch`, und der Streaming-Bereich benutzt dieselbe für eine
 * Auswahl über mehrere Spieltage und Ligen. Zwei Schleifen nebeneinander liefen
 * unweigerlich auseinander.
 *
 * NUR DER BILDAUFBAU „livestream": Das Highlight-Bild trägt den Endstand und
 * ist damit erst nach dem Spiel sinnvoll, der Stapel wird aber vorher gebraucht.
 * Nach dem Spiel holt man das einzelne Bild dort, wo das Ergebnis steht.
 *
 * ZWEI EINGÄNGE: `gameDay` für den Knopf je Spieltag, `items` für eine fertige
 * Liste über mehrere Spieltage und Ligen samt Bildaufbau je Bild (Saisonstapel
 * des Vereins, Thumbnail-Seite hinter dem OBS-Bedienfeld). Mit `items` kann der
 * Stapel auch Highlight-Bilder enthalten; der Aufrufer nimmt dann nur Spiele
 * mit Endstand auf (`highlightReady`). Beschriftung und Archivname kommen in
 * dem Fall vom Aufrufer, der seine Oberfläche übersetzt.
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
  @Input()
  gameDay?: ThumbnailBatchGameDayWithGames | null;

  /** Fertige Liste statt eines Spieltags; hat Vorrang vor `gameDay`. */
  @Input()
  items?: ThumbnailBatchItem[] | null;

  /** Archivname ohne `.zip`; ohne Angabe aus Liga und Spieltag gebildet. */
  @Input()
  zipName?: string | null;

  /** Beschriftung des Knopfs, ohne Angabe „Thumbnails". */
  @Input()
  label?: string | null;

  /** Beschriftung während des Durchgangs. */
  @Input()
  busyLabel?: string | null;

  /** Tooltip des Knopfs. */
  @Input()
  hint?: string | null;

  /**
   * Beschriftung immer zeigen. Im Spielplan steht der Knopf in einer engen
   * Reihe und zeigt auf dem Handy nur das Symbol; als einziger Knopf einer
   * Karte braucht er den Text auch dort.
   */
  @Input()
  alwaysShowLabel = false;

  /**
   * Ein einzelnes Bild als PNG statt als ZIP mit einem Eintrag ablegen: für
   * den Knopf je Spiel. Gilt nur, wenn genau ein Bild entstanden ist.
   */
  @Input()
  singleAsPng = false;

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
    return !this.total;
  }

  /** Erfolgreich geladene Ligen. Ein Fehlschlag wird nicht behalten. */
  private _leagues = new Map<number, League>();
  private _destroyed = false;

  constructor(
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  public get total(): number {
    return this._items().length;
  }

  private _items(): ThumbnailBatchItem[] {
    if (this.items) return this.items;

    const gameDay = this.gameDay;
    if (!gameDay?.games?.length) return [];

    return gameDay.games.map((game) => ({ game, gameDay }));
  }

  // Der Spielplan baut seine Spieltage bei jedem Neuladen neu und zerstört die
  // Komponente dabei. Ohne diesen Riegel liefe die Schleife auf der zerstörten
  // Ansicht weiter und legte am Ende ein Archiv im Download-Ordner ab, das
  // niemand mehr angefordert hat -- samt Meldung auf einer anderen Seite.
  public ngOnDestroy(): void {
    this._destroyed = true;
  }

  /** Zeichnet alle Bilder und legt sie als ZIP in den Download-Ordner. */
  public async download(): Promise<void> {
    const items = this._items();
    if (this.busy || !items.length) return;

    this.busy = true;
    this.done = 0;
    this._cdr.markForCheck();

    try {
      const { entries, report, aborted } = await renderThumbnailBatch(items, {
        league: (leagueId) => this._league$(leagueId),
        progress: (done) => {
          this.done = done;
          this._cdr.markForCheck();
        },
        capture: (error, item) => this._capture(error, item),
        cancelled: () => this._destroyed,
      });

      if (aborted) return;
      this._finish(entries, report, items);
    } catch (error) {
      // Alles außerhalb der Spiel-Schleife: das Verpacken, ein
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
    report: ThumbnailBatchReport,
    items: ThumbnailBatchItem[]
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

    const single = this.singleAsPng && entries.length === 1;

    try {
      if (single) {
        saveBlob(
          new Blob([entries[0].data], { type: 'image/png' }),
          entries[0].name.split('/').pop() || 'thumbnail.png'
        );
      } else {
        saveBlob(buildZip(entries), this._zipName(items));
      }
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

    const { level, text } = report.result(
      entries.length,
      items.length,
      single ? 'png' : 'zip'
    );
    this._notificationService[level](text, { keepAfterRouteChange: true });
  }

  /**
   * Die Liga, einmal geholt und behalten.
   *
   * Sie trägt Ligazeichen und Farbwelt, und beides steht in keinem Spielabruf.
   * Ein Fehlschlag liefert `null`: Dann steht die Paarung im neutralen Bild, und
   * die Meldung am Ende sagt das -- ganz ohne Bilder dastehen wäre die
   * schlechtere Antwort. Er wird aber NICHT behalten (in `_leagues` landet nur
   * ein Erfolg), sonst lieferte ein zweiter Klick nach einem kurzen
   * Netzproblem stillschweigend wieder neutrale Bilder.
   *
   * Der Fehler geht an Sentry, obwohl er die Oberfläche nicht aufhält: Es ist
   * der einzige Serverabruf dieses Wegs, und ein dauerhaft nicht erreichbarer
   * Ligaabruf erzeugt sonst beliebig lange Bilder ohne Wortmarke, ohne dass es
   * jemand erfährt.
   */
  private async _league$(leagueId: number): Promise<League | null> {
    // Ein Spieltag ohne Liga (`game_days.league_id` ist nullable): kein Abruf,
    // der 404 brächte nur eine zweite Meldung neben der des Berichts.
    if (!leagueId) return null;

    const known = this._leagues.get(leagueId);
    if (known) return known;

    const league = await firstValueFrom(
      this._leagueService.getSingleLeague(leagueId).pipe(
        catchError((error) => {
          this._capture(error);
          return of(null);
        })
      )
    );

    if (league) this._leagues.set(leagueId, league);

    return league;
  }

  private _zipName(items: ThumbnailBatchItem[]): string {
    if (this.zipName) return `${this.zipName}.zip`;

    const gameDay = items[0].gameDay;
    const parts = [
      'thumbnails',
      filenameSlug(this._leagues.get(gameDay.league_id)?.name || ''),
      folderName(gameDay),
    ].filter(Boolean);

    return `${parts.join('-')}.zip`;
  }

  /**
   * Ein Vorfall in Sentry ohne Angabe des Spieltags ist nicht auswertbar --
   * Frontend und Rails-API teilen sich dort ein Projekt, und „Das Bild konnte
   * nicht erzeugt werden." allein sagt niemandem etwas.
   */
  private _capture(error: unknown, item?: ThumbnailBatchItem): void {
    const gameDay = item?.gameDay ?? this.gameDay;
    Sentry.captureException(error, {
      tags: { feature: 'thumbnail-batch' },
      extra: {
        leagueId: gameDay?.league_id,
        gameDayNumber: gameDay?.number,
        gameDayDate: gameDay?.date,
        variant: item?.variant,
        pairing: item ? pairing(item.game) : undefined,
      },
    });
  }
}
