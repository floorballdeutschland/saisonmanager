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
} from '@floorball/types';
import { GameService, LeagueService, SessionService } from '@floorball/core';

@Component({
  selector: 'fb-match-report',
  templateUrl: './match-report.component.html',
})
export class MatchReportComponent implements OnInit, OnChanges {
  @ViewChild('sbbNavigation')
  sbbNavigationRef!: ElementRef<HTMLElement>;

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
      title: 'Kontrolle durch SBK',
      description: 'Zur Kontrolle durch die SBK freigegeben',
      confirm: true,
      confirmationTitle: 'Spielbericht abschließen',
      confirmationContent:
        'Soll die Eingabe wirklich abgeschlossen werden? Das Bearbeiten ist im Anschluss nicht mehr möglich. Möchtest du wirklich fortfahren?',
      confirmationButton: 'Eingabe abschließen',
    },
    {
      key: this.FINALIZED,
      title: 'Spiel abgeschlossen',
      description: 'Spiel wurde durch die SBK kontrolliert',
      confirm: true,
      confirmationTitle: 'Spiel abschließen',
      confirmationContent:
        'Sind alle eingetragenen Daten korrekt? Durch den Abschluss der Kontrolle wird der Spielbericht geschlossen und kann nicht mehr bearbeitet werden. Möchtest du wirklich fortfahren?',
      confirmationButton: 'Spiel abschließen',
    },
  ];

  // match report properties
  public appGameStatus = ''; // pregame, ingame, aftergame, match_record_closedgame, finalized
  public currentPeriod = '1';
  public penalties: Penalty[] = [];
  public penaltyCodes: PenaltyCode[] = [];

  // lineup properties
  public squadHistoryDialogOpen = '';
  public addDialogOpen = '';

  // checklist
  public checklistVisible = false;
  public checklistAnswers: Record<number, boolean | null> = {};
  public checklistSaving = false;

  constructor(
    private _leagueService: LeagueService,
    private _sessionService: SessionService,
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.appGameStatus = this.game.game_status;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['game']) {
      this.handleGameChange(changes['game']);
    }
  }

  handleGameChange(game: SimpleChange) {
    if (game.currentValue.id !== game.previousValue?.id) {
      this.appGameStatus = this.game.game_status;
    }

    this.currentPeriod = Math.floor(
      this.game.current_period_title?.period || 0
    ).toString();

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
      (item) => item.key === this.game?.game_status
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
    this.sbbNavigationRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  reloadGame() {
    this.handleReload.emit();
  }

  public canEditGame() {
    const teamPermission =
      ([this.PREGAME, this.INGAME, this.AFTERGAME].includes(
        this.game.game_status
      ) ||
        this.game.game_status === null) &&
      this.game?.permission?.includes('edit_game_report');

    return teamPermission || this.canCheckGame();
  }

  public canCheckGame() {
    const sbkPermission =
      this.game.game_status !== this.FINALIZED &&
      this.game?.permission?.includes('check_game');

    return sbkPermission;
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
      return statusIndex === this.gameStatusOptions.length - 1 ? -1 : 0;
    } else if (statusIndex < index) {
      return 1;
    } else {
      return -1;
    }
  }

  public isStatusButtonEnabled(index: number) {
    const status = this.gameStatusOptions[index];
    return (
      this.game.game_status !== this.FINALIZED &&
      (status?.key !== this.FINALIZED || this.canCheckGame())
    );
  }

  public closeMatchRecord() {
    if (
      this.game.checklist_active &&
      (this.game.checklist_items?.length ?? 0) > 0
    ) {
      this._initChecklistAnswers();
      this.checklistVisible = true;
      this._cdr.markForCheck();
      return;
    }
    this.handleGameStatusChange(this.MATCH_RECORD_CLOSED);
  }

  public allChecklistAnswered(): boolean {
    return (this.game.checklist_items ?? []).every(
      (item) =>
        this.checklistAnswers[item.id] !== null &&
        this.checklistAnswers[item.id] !== undefined
    );
  }

  public submitChecklist(): void {
    if (!this.allChecklistAnswered() || this.checklistSaving) return;
    this.checklistSaving = true;
    const answers = (this.game.checklist_items ?? []).map((item) => ({
      item_id: item.id,
      question: item.question,
      answer: this.checklistAnswers[item.id] as boolean,
    }));
    this._gameService.setChecklistAnswers(this.game.id, answers).subscribe({
      next: () => {
        this.game.checklist_answers = answers;
        this.checklistVisible = false;
        this.checklistSaving = false;
        this._cdr.markForCheck();
        this.handleGameStatusChange(this.MATCH_RECORD_CLOSED);
      },
      error: () => {
        this.checklistSaving = false;
        this._cdr.markForCheck();
      },
    });
  }

  public cancelChecklist(): void {
    this.checklistVisible = false;
    this._cdr.markForCheck();
  }

  private _initChecklistAnswers(): void {
    const existing = this.game.checklist_answers ?? [];
    this.checklistAnswers = {};
    for (const item of this.game.checklist_items ?? []) {
      const saved = existing.find((a) => a.item_id === item.id);
      this.checklistAnswers[item.id] = saved ? saved.answer : null;
    }
  }

  public finalizeGame() {
    this.handleGameStatusChange(this.FINALIZED);
  }

  public canReopenGame() {
    return (
      [this.MATCH_RECORD_CLOSED, this.FINALIZED].includes(
        this.game.game_status
      ) && this.game?.permission?.includes('check_game')
    );
  }

  public reopenGame() {
    this._gameService.reopenGame(this.game.id).subscribe({
      next: () => {
        this.game.game_status = this.AFTERGAME;
        this.appGameStatus = this.AFTERGAME;
        this.reloadGame();
      },
      error: () => {
        alert(
          'Spielbericht konnte nicht geöffnet werden. Bitte Seite neu laden.'
        );
      },
    });
  }
}
