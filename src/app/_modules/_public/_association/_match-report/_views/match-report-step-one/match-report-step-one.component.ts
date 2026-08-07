import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { GameService, LeagueService } from '@floorball/core';
import { Game, GameAdditionalFields } from '@floorball/types';
import { tap } from 'rxjs';

@Component({
  selector: 'fb-match-report-step-one',
  templateUrl: './match-report-step-one.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportStepOneComponent implements OnInit, OnChanges {
  fieldSize!: string;

  homeCoachNums: number[] = [1];
  guestCoachNums: number[] = [1];

  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  @Output()
  handleGameStatusChange = new EventEmitter<void>();

  // lineup properties
  public squadHistoryDialogOpen = '';
  public addDialogOpen = '';

  // Livestream-Overlays. Der Zugang gilt für den ganzen Spieltag, nicht nur
  // für dieses Spiel: Eine Übertragung zeigt in der Regel mehrere Partien
  // hintereinander.
  public overlayLink: {
    active: boolean;
    expires_at?: string;
    created_by?: string;
  } | null = null;
  // Klartext-URLs gibt es nur direkt nach dem Erzeugen. Danach liegt
  // serverseitig bloß der Digest, sie lassen sich also nicht nachladen.
  public overlayUrls: { overlay_url: string; dock_url: string } | null = null;
  public overlayBusy = false;
  public overlayError = '';
  public overlayCopied = '';

  constructor(
    private _leagueService: LeagueService,
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['additionalFields']) {
      const homeCount = this.initCoachCount(
        this.additionalFields?.home_team_coaches
      );
      const guestCount = this.initCoachCount(
        this.additionalFields?.guest_team_coaches
      );
      if (homeCount > this.homeCoachNums.length) {
        this.homeCoachNums = Array.from({ length: homeCount }, (_, i) => i + 1);
      }
      if (guestCount > this.guestCoachNums.length) {
        this.guestCoachNums = Array.from(
          { length: guestCount },
          (_, i) => i + 1
        );
      }
    }
  }

  // ── Livestream-Overlays ───────────────────────────────────────────────

  public loadOverlayLink(): void {
    if (!this.game?.game_day_id) return;

    this._gameService.getOverlayLink(this.game.game_day_id).subscribe({
      next: (link) => {
        this.overlayLink = link;
        this._cdr.markForCheck();
      },
      // Kein Fehlerhinweis: Der Abruf klärt nur, ob schon ein Zugang besteht.
      // Schlägt er fehl, bleibt der Knopf zum Erzeugen stehen.
      error: () => {
        this.overlayLink = null;
        this._cdr.markForCheck();
      },
    });
  }

  public generateOverlayLink(): void {
    if (!this.game?.game_day_id || this.overlayBusy) return;

    this.overlayBusy = true;
    this.overlayError = '';
    this._gameService.createOverlayLink(this.game.game_day_id).subscribe({
      next: (res) => {
        this.overlayUrls = {
          overlay_url: res.overlay_url,
          dock_url: res.dock_url,
        };
        this.overlayLink = {
          active: true,
          expires_at: res.expires_at,
          created_by: res.created_by,
        };
        this.overlayBusy = false;
        this._cdr.markForCheck();
      },
      error: (err) => {
        // Klartext wie im übrigen Spielbericht, der ist nicht übersetzt.
        this.overlayError =
          err?.status === 403
            ? 'Für diesen Spieltag darfst du keinen Overlay-Zugang erzeugen.'
            : 'Der Overlay-Zugang konnte nicht erzeugt werden. Bitte später erneut versuchen.';
        this.overlayBusy = false;
        this._cdr.markForCheck();
      },
    });
  }

  public revokeOverlayLink(): void {
    if (!this.game?.game_day_id || this.overlayBusy) return;

    this.overlayBusy = true;
    this.overlayError = '';
    this._gameService.revokeOverlayLink(this.game.game_day_id).subscribe({
      next: () => {
        this.overlayLink = { active: false };
        this.overlayUrls = null;
        this.overlayBusy = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.overlayError =
          'Der Zugang konnte nicht zurückgezogen werden. Bitte später erneut versuchen.';
        this.overlayBusy = false;
        this._cdr.markForCheck();
      },
    });
  }

  public copyOverlayUrl(kind: 'overlay' | 'dock', url: string): void {
    navigator.clipboard?.writeText(url);
    // Kurze Rückmeldung am Knopf, damit erkennbar ist, welcher der beiden
    // Links gerade in der Zwischenablage liegt.
    this.overlayCopied = kind;
    setTimeout(() => {
      this.overlayCopied = '';
      this._cdr.markForCheck();
    }, 2000);
  }

  private initCoachCount(
    coaches: GameAdditionalFields['home_team_coaches'] | undefined
  ): number {
    if (!coaches) return 1;
    type CoachKey = keyof GameAdditionalFields['home_team_coaches'];
    for (let i = 5; i >= 2; i--) {
      const fn = coaches[`coach${i}_first_name` as CoachKey];
      const ln = coaches[`coach${i}_last_name` as CoachKey];
      const str = coaches[`coach${i}_string` as CoachKey];
      if (fn || ln || str) return i;
    }
    return 1;
  }

  addCoach(team: 'home' | 'guest'): void {
    if (team === 'home' && this.homeCoachNums.length < 5) {
      this.homeCoachNums = [
        ...this.homeCoachNums,
        this.homeCoachNums.length + 1,
      ];
    } else if (team === 'guest' && this.guestCoachNums.length < 5) {
      this.guestCoachNums = [
        ...this.guestCoachNums,
        this.guestCoachNums.length + 1,
      ];
    }
  }

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.fieldSize = league.field_size;

            this._cdr.markForCheck();
          }
        })
      )
      .subscribe();

    this.loadOverlayLink();
  }

  reloadGame() {
    this.handleReload.emit();
  }

  public openSquadHistoryHomeDialog() {
    this.squadHistoryDialogOpen =
      this.squadHistoryDialogOpen !== '' ? '' : 'home';
  }

  public openSquadHistoryGuestDialog() {
    this.squadHistoryDialogOpen =
      this.squadHistoryDialogOpen !== '' ? '' : 'guest';
  }

  public openAddHomeDialog() {
    this.addDialogOpen = this.addDialogOpen !== '' ? '' : 'home';
  }

  public openAddGuestDialog() {
    this.addDialogOpen = this.addDialogOpen !== '' ? '' : 'guest';
  }

  public closeAddDialog() {
    this.addDialogOpen = '';
    this.reloadGame();
  }

  public closeSquadHistoryDialog() {
    this.squadHistoryDialogOpen = '';
  }

  public startEvents() {
    this.handleGameStatusChange.emit();
  }
}
