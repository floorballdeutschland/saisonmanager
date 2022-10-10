import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  Penalty,
  PenaltyCode,
} from '@floorball/types';
import { LeagueService } from '@floorball/core';

@Component({
  selector: 'fb-match-report',
  templateUrl: './match-report.component.html',
})
export class MatchReportComponent {
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
  public appGameStatus = 'ingame'; // pregame, ingame, aftergame, match_record_closedgame, finalized
  public currentPeriod = '1';
  public penalties: Penalty[] = [];
  public penaltyCodes: PenaltyCode[] = [];

  // lineup properties
  public squadHistoryDialogOpen = '';
  public addDialogOpen = '';

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  scrollToSbbNavigation() {
    this.sbbNavigation.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  reloadGame() {
    this.handleReload.emit();
  }

  public isGameStatusActive(index: number) {
    const statusIndex = this.gameStatusOptions.findIndex(
      (item) => item.key === this.appGameStatus
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
