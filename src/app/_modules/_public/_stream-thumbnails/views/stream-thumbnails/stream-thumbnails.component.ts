import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { GameService } from '@floorball/core';
import { OverlayGameDayGame, OverlayGameDayPayload } from '@floorball/types';
import {
  filenameSlug,
  thumbnailDateLine,
} from 'src/app/_helpers/_utils/stream-thumbnail';
import {
  ThumbnailBatchGameDay,
  ThumbnailBatchItem,
  folderName,
  highlightReady,
} from 'src/app/_helpers/_utils/thumbnail-batch';

export type StreamThumbnailsState =
  | 'loading'
  | 'noToken'
  | 'notStarted'
  | 'expired'
  | 'failed'
  | 'ready';

export interface StreamThumbnailRow {
  game: OverlayGameDayGame;
  /** Je ein Eintrag, fest gehalten: `fb-thumbnail-batch` liest die Länge bei jeder Prüfung. */
  livestream: ThumbnailBatchItem[];
  /** Leer, solange das Spiel keinen Endstand hat. */
  highlights: ThumbnailBatchItem[];
}

/**
 * YouTube-Thumbnails eines Spieltags für die Person, die streamt (feedback#77).
 *
 * Erreicht über das Bedienfeld (`overlay/dock.html`), mit dessen Token und
 * ohne Anmeldung. Das Bedienfeld zeichnet die Bilder nicht selbst: Ein
 * OBS-Dock hat keinen Download-Handler, ein Speichern dort verpufft ohne
 * Meldung. Ein Link mit `target="_blank"` öffnet OBS dagegen im normalen
 * Browser, und dort läuft dieselbe Zeichnung wie im Spielbericht
 * (`renderThumbnailPng` über `fb-thumbnail-batch`).
 *
 * Alle Angaben kommen aus EINEM Abruf (`public/overlay/game_day`), nicht aus
 * einem `live`-Abruf je Spiel: Die laufenden Browser-Quellen der Übertragung
 * hängen am selben Drosseltopf. Liga, Zeichen und Farbwelt holt
 * `fb-thumbnail-batch` wie überall aus dem öffentlichen Ligaabruf.
 */
@Component({
  templateUrl: './stream-thumbnails.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StreamThumbnailsComponent implements OnInit, OnDestroy {
  public state: StreamThumbnailsState = 'loading';
  /** Begründung des Servers, wenn der Zugang noch nicht gilt. */
  public serverMessage = '';
  public payload: OverlayGameDayPayload | null = null;
  public rows: StreamThumbnailRow[] = [];
  public allLivestream: ThumbnailBatchItem[] = [];
  public allHighlights: ThumbnailBatchItem[] = [];

  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _gameService: GameService,
    private _meta: Meta,
    private _location: Location,
    private _cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    // Die Adresse trägt den Zugang: gehört nicht in Suchmaschinen.
    this._meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    const token = this._route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.state = 'noToken';
      return;
    }

    // Das Overlay-Token schreibt auch den Steuerzustand der Übertragung
    // (`POST public/overlay/state`). In der Adresszeile landete es im Verlauf,
    // in Lesezeichen und in jedem Bildschirmfoto; also nach dem Lesen heraus
    // damit. Gebraucht wird es nur für den einen Abruf unten. Über `Location`
    // statt `history`, damit es ohne Browser (Prerender) nichts anfasst.
    this._location.replaceState(this._location.path().split('?')[0]);

    this._gameService
      .getOverlayGameDay(token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (payload) => this._apply(payload),
        error: (error: unknown) => this._fail(error),
      });
  }

  public ngOnDestroy(): void {
    this._meta.removeTag("name='robots'");
    this._destroy$.next();
    this._destroy$.complete();
  }

  /** „Sa. 12.10.2026", ohne Umweg über `new Date` (Tag ohne Zeitzone). */
  public get dateLine(): string {
    return thumbnailDateLine(this.payload?.game_day.date, null, 'highlights');
  }

  public pairing(game: OverlayGameDayGame): string {
    return `${game.home_team || 'N.N.'} – ${game.guest_team || 'N.N.'}`;
  }

  public zipName(variant: 'livestream' | 'highlights'): string {
    const gameDay = this.payload?.game_day;

    return [
      'thumbnails',
      variant,
      filenameSlug(gameDay?.league || ''),
      gameDay ? folderName(this._gameDay(gameDay)) : '',
    ]
      .filter(Boolean)
      .join('-');
  }

  private _apply(payload: OverlayGameDayPayload): void {
    this.payload = payload;
    const gameDay = this._gameDay(payload.game_day);

    this.rows = payload.games.map((game) => {
      const batchGame = {
        start_time: game.start_time ?? '',
        home_team_name: game.home_team ?? '',
        guest_team_name: game.guest_team ?? '',
        home_team_logo: game.home_team_logo ?? null,
        guest_team_logo: game.guest_team_logo ?? null,
        ended: game.ended,
        result: game.result ?? null,
      };

      return {
        game,
        livestream: [{ game: batchGame, gameDay, variant: 'livestream' }],
        highlights: highlightReady(batchGame)
          ? [{ game: batchGame, gameDay, variant: 'highlights' }]
          : [],
      };
    });
    this.allLivestream = this.rows.flatMap((row) => row.livestream);
    this.allHighlights = this.rows.flatMap((row) => row.highlights);
    this.state = 'ready';
    this._cdr.markForCheck();
  }

  private _gameDay(
    gameDay: OverlayGameDayPayload['game_day']
  ): ThumbnailBatchGameDay {
    return {
      number: gameDay.number ?? 0,
      date: gameDay.date,
      league_id: gameDay.league_id ?? 0,
      arena: { name: gameDay.arena },
    };
  }

  /**
   * 403 heißt „noch nicht gültig" (Zugänge gelten erst kurz vor dem Spieltag), 400
   * und 410 „ungültig oder abgelaufen". Der ErrorInterceptor lässt diese
   * Antworten durch, die Seite benennt sie selbst.
   */
  private _fail(error: unknown): void {
    const status = error instanceof HttpErrorResponse ? error.status : 0;

    if (status === 403) {
      this.state = 'notStarted';
      const body = (error as HttpErrorResponse).error;
      this.serverMessage =
        body && typeof body.message === 'string' ? body.message : '';
    } else if (status === 400 || status === 404 || status === 410) {
      this.state = 'expired';
    } else {
      this.state = 'failed';
    }
    this._cdr.markForCheck();
  }
}
