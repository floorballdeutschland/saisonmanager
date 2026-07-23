import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  Penalty,
  PenaltyCode,
  PeriodTitles,
} from '@floorball/types';
import {
  GameService,
  LeagueService,
  NotificationService,
} from '@floorball/core';

@Component({
  selector: 'fb-match-report-step-two',
  templateUrl: './match-report-step-two.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportStepTwoComponent implements OnInit {
  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Input()
  currentPeriod!: string;

  @Output()
  handleSbbScroll = new EventEmitter<void>();

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  // match report properties
  public game_period = '2';
  public event = '';
  public penalties: Penalty[] = [];
  public penaltyCodes: PenaltyCode[] = [];

  public regularTimeSummary: PeriodTitles = {
    period: 100,
    short_title: 'REG',
    title: 'Reguläre Spielzeit',
    status_id: 'reg',
    running: false,
    can_end_game: false,
    optional: false,
  };

  public overtimeSummary: PeriodTitles = {
    period: 200,
    short_title: 'V',
    title: 'Verlängerung',
    status_id: 'ot',
    running: false,
    can_end_game: false,
    optional: true,
  };

  constructor(
    private _leagueService: LeagueService,
    private _gameService: GameService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._leagueService.getPenalties().subscribe({
      next: (penalties) => {
        this.penalties = penalties;
      },
    });

    this._leagueService.getPenaltyCodes().subscribe({
      next: (penalties) => {
        this.penaltyCodes = penalties;
      },
    });
  }

  public setCurrentPeriod(period: string) {
    this.currentPeriod = period;
  }

  public setEvent(eventName: string): void {
    if (this.event === eventName) {
      this.event = '';
    } else {
      this.event = eventName;
      if (!this.game?.started && eventName === 'next') {
        setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 150);
      }
    }
    this._cdr.markForCheck();
  }

  scrollToSbbNavigation() {
    this.handleSbbScroll.emit();
  }

  reloadGame() {
    this.handleReload.emit();
    this.event = '';
  }

  public bothLineupsPresent(): boolean {
    return (
      (this.game?.players?.home?.length ?? 0) > 0 &&
      (this.game?.players?.guest?.length ?? 0) > 0
    );
  }

  // Befindet sich das Spiel aktuell im Penalty-Schießen?
  public isShootout(): boolean {
    return this.game?.current_period_title?.status_id === 'penalty_shots';
  }

  public removeTimeout(team: 'home' | 'guest'): void {
    const field =
      team === 'home' ? 'home_timeout_string' : 'guest_timeout_string';
    this._gameService.setGameField(this.game.id, { [field]: '' }).subscribe({
      next: () => {
        this._notificationService.success('Time-Out entfernt', {
          autoClose: true,
          keepAfterRouteChange: true,
        });
        this.reloadGame();
      },
    });
  }

  public isGamePeriodActive(index: number) {
    const currentlyOptional = this.game.current_period_title?.optional;
    const statusIndex = this.game.period_titles
      .filter((period) => period.optional === currentlyOptional)
      .findIndex((item) => item.status_id === this.game.ingame_status);

    if (statusIndex < 0) {
      return 1;
    } else if (statusIndex === index) {
      return 0;
    } else if (statusIndex < index) {
      return 1;
    } else {
      return -1;
    }
  }
}
