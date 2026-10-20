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
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  GameScan,
  Penalty,
  PenaltyCode,
} from '@floorball/types';
import {
  GameService,
  GameShotService,
  LeagueService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import * as Sentry from '@sentry/angular';
import { TabletShotSyncService } from '../../_components/tablet-capture/tablet-shot-sync.service';
import {
  isPdfFile,
  PDF_UPLOAD_ACCEPT,
} from 'src/app/_helpers/_utils/pdf-upload';

@Component({
  selector: 'fb-match-report',
  templateUrl: './match-report.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
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

  // Zeigt das Fenster nur die Zusammenfassung statt aller Fragen? Gesetzt wird
  // das einmal beim Oeffnen: War in der Spielvorbereitung schon alles
  // beantwortet, gibt es nichts mehr auszufuellen, und die Liste waere bei
  // sechzehn Fragen ein Bildschirm voll Wiederholung. Wer doch etwas aendern
  // will, klappt sie ueber `expandChecklist` auf -- zurueck geht es bewusst
  // nicht, sonst verdeckte die Zusammenfassung eine gerade getroffene Auswahl.
  public checklistConfirmOnly = false;

  // Tabletmodus (fe#344): Frage „Schüsse vollständig erfasst?" vor dem
  // Abschließen, nur bei Spielen mit Tablet-Daten. `tabletCompleteAnswered`
  // gilt für genau einen Abschlussversuch und wird danach zurückgesetzt.
  public tabletCompleteVisible = false;
  public tabletCompleteSaving = false;
  // Vor der Frage wird übertragen, was dieses Gerät noch puffert. Bleibt dabei
  // etwas liegen, warnt das Fenster: Nach dem Abschluss nimmt der Server es
  // nicht mehr an.
  public tabletChecking = false;
  public tabletUnsent = 0;
  private _tabletCompleteAnswered = false;

  // scan upload
  public existingScan: GameScan | null = null;
  public selectedScanFile: File | null = null;
  public readonly pdfUploadAccept = PDF_UPLOAD_ACCEPT;
  public scanUploading = false;
  public scanUploadError = '';

  constructor(
    private _leagueService: LeagueService,
    private _sessionService: SessionService,
    private _gameService: GameService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef,
    private _gameShotService: GameShotService,
    private _shotSync: TabletShotSyncService
  ) {}

  ngOnInit() {
    this.appGameStatus = this.game.game_status;
    if (this.game.scan_required) {
      this._loadScan();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['game']) {
      this.handleGameChange(changes['game']);
    }
  }

  handleGameChange(game: SimpleChange) {
    if (game.currentValue.id !== game.previousValue?.id) {
      this.appGameStatus = this.game.game_status;
      // Die Abschlussfrage gehört zum vorigen Spiel.
      this.tabletCompleteVisible = false;
      this.tabletCompleteSaving = false;
      this.tabletChecking = false;
      this.tabletUnsent = 0;
      this._tabletCompleteAnswered = false;
    }

    // Vor dem ersten Abschnitt gibt es noch keinen current_period_title. Die
    // Abschnitte beginnen bei 1; mit 0 als Rückfall landete ein früh erfasstes
    // Tor in Abschnitt 0, zählte im Spielstand mit, stand aber unter keinem
    // Abschnitt und wurde doppelt eingetragen (Spiel 63201).
    this.currentPeriod = Math.floor(
      this.game.current_period_title?.period || 1
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

    if (
      statusIndex > maxStatusIndex &&
      newStatus === this.MATCH_RECORD_CLOSED &&
      !this._tabletCompleteAnswered &&
      (this.game.tablet_capture ||
        this._shotSync.pendingCount(this.game.id) > 0)
    ) {
      this.tabletCompleteSaving = false;
      this.tabletCompleteVisible = true;
      this.tabletUnsent = 0;
      if (this._shotSync.pendingCount(this.game.id) > 0) {
        this.sendPendingShots();
      }
      this._cdr.markForCheck();
      return;
    }
    this._tabletCompleteAnswered = false;

    if (statusIndex > maxStatusIndex) {
      this._gameService.setGameStatus(this.game.id, newStatus).subscribe({
        next: () => {
          this.game.game_status = newStatus;
          this.reloadGame();
        },
        error: (err) => {
          // Beim Abschließen/Freigeben blockiert das Backend u. a., wenn
          // Schiedsrichter 1 fehlt oder die Checkliste unvollständig ist –
          // diese Meldung muss sichtbar werden, und der Status darf nicht
          // vorrücken.
          //
          // ACHTUNG, hier stand lange, der ErrorInterceptor ersetze den Fehler
          // durch einen reinen String und zeige selbst nichts an. Beides gilt
          // seit fbb73a54 (06.07.2026) nicht mehr: Er reicht die
          // HttpErrorResponse unverändert weiter UND meldet jedes übrige 4xx
          // selbst. Diese Meldung steht damit doppelt; der String-Zweig unten
          // greift nur noch beim Prerender. Nicht kopieren – der neue Zweig in
          // `submitChecklist` verzichtet deshalb auf eine eigene Meldung.
          const message =
            (typeof err === 'string' ? err : err?.error?.message) ||
            'Der Spielstatus konnte nicht geändert werden.';
          this._notificationService.error(message);
          this.appGameStatus = this.game.game_status;
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

  public canUploadScan(): boolean {
    return !!(
      this.canCheckGame() || this.game?.permission?.includes('edit_game_report')
    );
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
      // Blieb eine vorige Antwort aus (Funkloch in der Halle), stuende der
      // Bestaetigungsknopf sonst dauerhaft auf "Speichern..." und waere
      // gesperrt, ohne dass etwas laeuft.
      this.checklistSaving = false;
      this.checklistConfirmOnly = this.allChecklistAnswered();
      this.checklistVisible = true;
      this._cdr.markForCheck();
      return;
    }
    this.handleGameStatusChange(this.MATCH_RECORD_CLOSED);
  }

  // Der Stand wird als neues Objekt gesetzt, nicht in place geändert: Die
  // Fragenliste ist inzwischen eine eigene Komponente und bekommt ihn als
  // Eingabe gereicht.
  public setChecklistAnswer(event: { itemId: number; answer: boolean }): void {
    this.checklistAnswers = {
      ...this.checklistAnswers,
      [event.itemId]: event.answer,
    };
    this._cdr.markForCheck();
  }

  public expandChecklist(): void {
    this.checklistConfirmOnly = false;
    this._cdr.markForCheck();
  }

  public get checklistItemCount(): number {
    return this.game.checklist_items?.length ?? 0;
  }

  // Verneinte Punkte stehen in der Zusammenfassung mit dabei: Sie setzen die
  // zustaendige SBK auf BCC der Bestaetigungsmail (`GameMailer#checklist_
  // confirmation` in der API), und wer nur eine Zahl liest, bestaetigt sonst
  // ungewollt eine Beanstandung.
  public get checklistDeniedCount(): number {
    return (this.game.checklist_items ?? []).filter(
      (item) => this.checklistAnswers[item.id] === false
    ).length;
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
      // Bewusst ohne eigene Meldung: Der ErrorInterceptor zeigt fuer diesen
      // Endpunkt bereits einen Toast und liest die Serverbegruendung dabei
      // genauer aus, als es hier moeglich waere (er wertet neben `message`
      // auch `error` und `errors[]` aus und zieht Validierungs-Hashes flach).
      // Eine zweite Meldung laege deckungsgleich darueber und muesste einzeln
      // weggeklickt werden -- der Interceptor warnt an mehreren Stellen selbst
      // davor.
      //
      // Das Fenster bleibt stehen, damit die Antworten nicht verloren gehen.
      error: (err) => {
        this.checklistSaving = false;
        this._cdr.markForCheck();

        // Einen Serverfehler meldet der Toast dem Anwender, aber niemandem
        // sonst: Der eigene error-Zweig verbraucht ihn, Sentrys ErrorHandler
        // sieht nur unbehandelte Fehler. 4xx sind hier fachliche Absagen und
        // gehoeren nicht hinein.
        if (err?.status >= 500) Sentry.captureException(err);
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

  /**
   * Antwort auf „Schüsse vollständig erfasst?". Der Abschluss läuft auch dann
   * weiter, wenn das Speichern der Antwort scheitert: Die Schussdaten sind
   * eine Beta-Zugabe und dürfen den Spielbericht nicht aufhalten. Den Fehler
   * meldet der ErrorInterceptor, ein 5xx geht zusätzlich an Sentry.
   */
  public answerTabletComplete(complete: boolean): void {
    if (this.tabletCompleteSaving || this.tabletChecking) return;
    this.tabletCompleteSaving = true;
    const gameId = this.game.id;
    const proceed = () => {
      if (this.game?.id !== gameId) return;
      this.tabletCompleteVisible = false;
      this.tabletCompleteSaving = false;
      this._tabletCompleteAnswered = true;
      this._cdr.markForCheck();
      this.handleGameStatusChange(this.MATCH_RECORD_CLOSED);
    };
    this._gameShotService.setTabletShotsComplete(gameId, complete).subscribe({
      next: (response) => {
        this.game.tablet_shots_complete = response.tablet_shots_complete;
        proceed();
      },
      error: (err) => {
        if (err?.status >= 500) Sentry.captureException(err);
        proceed();
      },
    });
  }

  /** Ausdrücklich angestoßen, also auch nach einer früheren Absage. */
  public sendPendingShots(): void {
    const gameId = this.game.id;
    this.tabletChecking = true;
    this._shotSync.retry(gameId).then(() => {
      if (this.game?.id !== gameId) return;
      this.tabletChecking = false;
      this.tabletUnsent = this._shotSync.pendingCount(gameId);
      this._cdr.markForCheck();
    });
  }

  public cancelTabletComplete(): void {
    this.tabletCompleteVisible = false;
    this.tabletCompleteSaving = false;
    this.appGameStatus = this.game.game_status;
    this._cdr.markForCheck();
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

  public onScanFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.scanUploadError = '';

    if (file && !isPdfFile(file)) {
      this.selectedScanFile = null;
      this.scanUploadError =
        'Bitte wähle eine PDF-Datei. Fotos werden nicht mehr angenommen.';
      // Sonst löst dieselbe Datei beim erneuten Auswählen kein change aus.
      input.value = '';
      return;
    }

    this.selectedScanFile = file;
  }

  public uploadScan() {
    if (!this.selectedScanFile) return;

    const maxSize = 5 * 1024 * 1024;
    if (this.selectedScanFile.size > maxSize) {
      this.scanUploadError = 'Die Datei ist zu groß (max. 5 MB).';
      return;
    }

    this.scanUploading = true;
    this.scanUploadError = '';

    this._gameService
      .uploadGameScan(this.game.id, this.selectedScanFile)
      .subscribe({
        next: (scan) => {
          this.existingScan = scan;
          this.selectedScanFile = null;
          this.scanUploading = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.scanUploadError =
            err?.error?.errors?.join(', ') ?? 'Upload fehlgeschlagen.';
          this.scanUploading = false;
          this._cdr.markForCheck();
        },
      });
  }

  private _loadScan() {
    this._gameService.getGameScan(this.game.id).subscribe({
      next: (scan) => {
        this.existingScan = scan;
        this._cdr.markForCheck();
      },
    });
  }
}
