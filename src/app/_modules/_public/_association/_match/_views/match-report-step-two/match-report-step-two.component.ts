import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  Penalty,
  PenaltyCode,
} from '@floorball/types';
import { LeagueService } from '@floorball/core';

@Component({
  selector: 'fb-match-report-step-two',
  templateUrl: './match-report-step-two.component.html',
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

  // game_periods
  public gamePeriodOptions = [
    { key: '1', title: '1. Drittel' },
    { key: 'P1', title: '1. Drittelpause' },
    { key: '2', title: '2. Drittel' },
    { key: 'P2', title: '2. Drittelpause' },
    { key: '3', title: '3. Drittel' },
    { key: 'V', title: 'Verlängerung' },
    // { key: 'PS', title: 'Penalty-Schließen' },
  ];

  constructor(
    private _leagueService: LeagueService,
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

  public isGamePeriodActive(index: number) {
    const statusIndex = this.game.period_titles.findIndex(
      (item) => item.status_id === this.game.ingame_status
    );

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
