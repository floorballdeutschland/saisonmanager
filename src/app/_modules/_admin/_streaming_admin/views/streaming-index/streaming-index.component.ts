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
} from '@floorball/core';
import { League, StreamingGame } from '@floorball/types';
import { filenameSlug, saveBlob } from 'src/app/_helpers/_utils/stream-thumbnail';
import {
  ThumbnailBatchItem,
  renderThumbnailBatch,
} from 'src/app/_helpers/_utils/thumbnail-batch';
import { buildZip } from 'src/app/_helpers/_utils/zip-store';

type Mode = 'range' | 'matchday';

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

  private _leagueCache = new Map<number, League | null>();
  private _destroyed = false;

  constructor(
    private _streamingService: StreamingService,
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    const [von, bis] = kommendesWochenende();
    this.from = von;
    this.to = bis;
    this._loadLeagues();
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
