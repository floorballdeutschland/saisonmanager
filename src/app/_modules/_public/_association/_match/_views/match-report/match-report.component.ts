import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChange,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  Penalty,
  PenaltyCode,
  PeriodTitles,
} from '@floorball/types';
import { GameService, LeagueService } from '@floorball/core';

@Component({
  selector: 'fb-match-report',
  templateUrl: './match-report.component.html',
})
export class MatchReportComponent implements OnInit, OnChanges {
  @ViewChild('sbbNavigation')
  sbbNavigation!: ElementRef<HTMLElement>;

  @Input()
  game!: Game;

  @Input()
  additionalFields?: GameAdditionalFields;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  public PREGAME = 'pregame';
  public INGAME = 'ingame';
  public AFTERGAME = 'aftergame';
  public MATCH_RECORD_CLOSED = 'match_record_closed';
  public FINALIZED = 'finalized';

  // game status
  public gameStatusOptions = [
    {
      key: this.PREGAME,
      title: 'Spiel vorbereiten',
      description: 'Kader, Betreuer, Schiedsrichter und Spielsekretariat',
    },
    {
      key: this.INGAME,
      title: 'Events eintragen',
      description: 'Tore, Strafen und Auszeiten',
    },
    {
      key: this.AFTERGAME,
      title: 'Spiel nachbereiten',
      description: 'Unterschriften und besondere Ereignisse',
    },
    {
      key: this.MATCH_RECORD_CLOSED,
      title: 'Eigabe abschließen',
      description: 'Für Kontrolle durch die SBK freigegeben',
    },
    {
      key: this.FINALIZED,
      title: 'Kontrolle',
      description: 'Spiel wurde durch die SBK kontrolliert',
    },
  ];

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

  // match report properties
  public gameStatus = ''; // pregame, ingame, aftergame, match_record_closedgame, finalized
  public appGameStatus = ''; // pregame, ingame, aftergame, match_record_closedgame, finalized
  public currentPeriod = '1';
  public penalties: Penalty[] = [];
  public penaltyCodes: PenaltyCode[] = [];

  // lineup properties
  public squadHistoryDialogOpen = '';
  public addDialogOpen = '';

  constructor(
    private _leagueService: LeagueService,
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.appGameStatus = this.game.game_status;
    console.log(this.gameStatus);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['game']) {
      this.handleGameChange(changes['game']);
    }
    console.log(changes);
  }

  handleGameChange(game: SimpleChange) {
    if (game.currentValue.id !== game.previousValue?.id) {
      this.appGameStatus = this.game.game_status;
    }

    if (
      game.currentValue.game_status === 'aftergame' &&
      game.previousValue?.game_status === 'ingame'
    ) {
      this.appGameStatus = this.game.game_status;
    }
  }

  handleGameStatusChange(newStatus: string) {
    const statusIndex = this.gameStatusOptions.findIndex(
      (item) => item.key === newStatus
    );
    const maxStatusIndex = this.gameStatusOptions.findIndex(
      (item) => item.key === this.additionalFields?.game_status
    );

    if (statusIndex > maxStatusIndex) {
      this._gameService.setGameStatus(this.game.id, newStatus).subscribe({
        next: () => {
          this.game.game_status = newStatus;
          this.reloadGame();
        },
      });
    }

    this.appGameStatus = newStatus;
  }

  scrollToSbbNavigation() {
    this.sbbNavigation.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  reloadGame() {
    this.handleReload.emit();
  }

  public isGameStatusActive(index: number, type: 'app' | 'game' = 'app') {
    const statusIndex = this.gameStatusOptions.findIndex(
      (item) =>
        item.key ===
        (type === 'app' ? this.appGameStatus : this.game.game_status)
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
