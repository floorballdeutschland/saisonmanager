import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import {
  AssociationService,
  NotificationService,
  SessionService,
  TransferRequestService,
} from '@floorball/core';
import { TransferRequest, TransferRequestType } from '@floorball/types';
import {
  exportTransferCsv,
  transferStatusClass,
  transferStatusLabel,
  transferTypeClass,
  transferTypeLabel,
} from '../../transfer-request-presentation';

const OPEN_STATUSES: string[] = [
  'pending_club',
  'pending_player',
  'pending_lv',
];

export interface TransferSummaryRow {
  key: TransferRequestType | 'total';
  outgoing: number;
  incoming: number;
  open: number;
  granted: number;
  failed: number;
  total: number;
}

@Component({
  templateUrl: './transfer-request-list.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TransferRequestListComponent implements OnInit, OnDestroy {
  requests: TransferRequest[] = [];
  loading = false;
  currentUserClubIds: number[] = [];
  isSbk = false;
  withdrawingId: number | null = null;

  /** Saisonnamen aus `init.json`, die Vorgaenge tragen nur die ID. */
  private _seasonNames = new Map<number, string>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _sessionService: SessionService,
    private _associationService: AssociationService,
    private _notificationService: NotificationService,
    private _router: Router,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.currentUserClubIds = user?.club_ids || [];
          this.isSbk = !!user?.permissions?.['menu_item_transfer_requests_sbk'];
          this._cdr.markForCheck();
        },
      });

    // `init.json` und nicht `admin/settings/seasons`: Letzteres ist Admin und
    // RSK vorbehalten, der Vereinsmanager bekaeme ein 403.
    this._associationService.seasons$
      .pipe(takeUntil(this._destroy$))
      .subscribe((seasons) => {
        this._seasonNames = new Map((seasons ?? []).map((s) => [s.id, s.name]));
        this._cdr.markForCheck();
      });

    this.loadRequests();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Vergangene Saisons sind standardmäßig ausgeblendet. Der Saisonwechsel räumt
   * die Vorgänge nicht ab — ohne diesen Riegel wüchse die Liste über die Jahre
   * unbegrenzt. Ausgeblendet, nicht weggeworfen: Die Gebühren für erteilte
   * Freigaben werden am Saisonende gestellt.
   */
  allSeasons = false;

  /** Welcher Umfang tatsächlich in `requests` steht. */
  private _loadedAllSeasons = false;

  toggleAllSeasons(): void {
    if (this.loading) return;

    this.allSeasons = !this.allSeasons;
    this.selectedSeasonId = null;
    this.loadRequests();
  }

  /**
   * Einzelne Saison innerhalb von „Vergangene Saisons anzeigen"; `null` heisst
   * alle. Gefiltert wird im Browser, die Liste ist dann ohnehin vollstaendig
   * geladen.
   *
   * Massgeblich ist `season_id`, also die Saison, in der der Vorgang angelegt
   * wurde, nicht die des Genehmigungsdatums. Ein im Mai beantragter und im
   * Juli genehmigter Wechsel zaehlt damit zur alten Saison.
   */
  selectedSeasonId: number | null = null;

  selectSeason(value: string): void {
    this.selectedSeasonId = value ? Number(value) : null;
    this._cdr.markForCheck();
  }

  /** Die Saisons, in denen es Vorgaenge gibt, neueste zuerst. */
  get seasonOptions(): { id: number; name: string }[] {
    const ids = [...new Set(this.requests.map((r) => r.season_id))].filter(
      (id) => id != null
    );
    return ids
      .sort((a, b) => b - a)
      .map((id) => ({ id, name: this._seasonNames.get(id) ?? String(id) }));
  }

  /** Grundlage fuer Tabellen, Zaehlung und CSV. */
  get visibleRequests(): TransferRequest[] {
    if (!this.allSeasons || this.selectedSeasonId === null)
      return this.requests;
    return this.requests.filter((r) => r.season_id === this.selectedSeasonId);
  }

  /**
   * Der Abruf ist gescheitert. Ohne diese Unterscheidung rendert das Template
   * den Leer-Hinweis und behauptet damit, es gebe keine Vorgänge — obwohl
   * niemand das weiß.
   */
  loadFailed = false;

  loadRequests(): void {
    this.loading = true;
    this.loadFailed = false;
    this._cdr.markForCheck();
    this._transferService
      .getAll(this.allSeasons)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.requests = result;
          this._loadedAllSeasons = this.allSeasons;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate(
              'transferRequestAdmin.notifications.loadError'
            )
          );
          // Die alten Zeilen mit weg: Sonst stehen Tabelle und Fehlerkasten
          // uebereinander, und der Landesverband liest die stehengebliebenen
          // Zeilen als vollstaendiges Ergebnis.
          this.requests = [];
          // Und der Schalter zurueck auf das, was tatsaechlich geladen ist --
          // sonst behauptet seine Beschriftung, die Vergangenheit sei
          // eingeblendet.
          this.allSeasons = this._loadedAllSeasons;
          this.loading = false;
          this.loadFailed = true;
          this._cdr.markForCheck();
        },
      });
  }

  openDetail(id: number): void {
    this._router.navigate(['/verwaltung/transfer-anfragen', id]);
  }

  initiateNew(): void {
    this._router.navigate(['/verwaltung/transfer-anfragen/neu']);
  }

  directAssign(): void {
    this._router.navigate(['/verwaltung/transfer-anfragen/direktzuweisung']);
  }

  openIncoming(): void {
    this._router.navigate(['/verwaltung/transfer-anfragen/eingehend']);
  }

  canWithdraw(r: TransferRequest): boolean {
    return (
      (r.status === 'pending_club' || r.status === 'pending_lv') &&
      this.currentUserClubIds.includes(r.requesting_club.id)
    );
  }

  withdraw(r: TransferRequest, event: Event): void {
    event.stopPropagation();
    if (
      !confirm(
        this._transloco.translate(
          'transferRequestAdmin.notifications.withdrawConfirm'
        )
      )
    )
      return;

    this.withdrawingId = r.id;
    this._transferService
      .withdraw(r.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.requests = this.requests.map((req) =>
            req.id === updated.id ? updated : req
          );
          this.withdrawingId = null;
          this._notificationService.success(
            this._transloco.translate(
              'transferRequestAdmin.notifications.withdrawn'
            ),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.withdrawingId = null;
          this._notificationService.error(
            this._transloco.translate(
              'transferRequestAdmin.notifications.withdrawError'
            ),
            {
              autoClose: false,
            }
          );
          this._cdr.markForCheck();
        },
      });
  }

  statusLabel(status: string): string {
    return transferStatusLabel(this._transloco, status);
  }

  statusClass(status: string): string {
    return transferStatusClass(status);
  }

  typeLabel(r: TransferRequest): string {
    return transferTypeLabel(this._transloco, r);
  }

  typeClass(r: TransferRequest): string {
    return transferTypeClass(r);
  }

  get canInitiate(): boolean {
    return this.currentUserClubIds.length > 0;
  }

  /**
   * Der Verein darf die Ausfuhr ebenso ziehen wie der Verband: Er sieht ohnehin
   * jede Zeile, und nur so kann er eine Gebuehrenrechnung gegenpruefen.
   */
  get canExport(): boolean {
    return this.isSbk || this.currentUserClubIds.length > 0;
  }

  /**
   * Zaehlung je Typ. `granted` folgt genau der Auswahl von `grantedRequests`,
   * damit die Zahl „erteilt" mit den Zeilen der CSV uebereinstimmt; `open` und
   * `failed` teilen den Rest, jeder Vorgang steht in genau einer der drei.
   *
   * Richtung nur fuer Vereinskonten: Abgehend heisst, ein eigener Verein ist
   * der abgebende, eingehend, ein eigener Verein ist der aufnehmende. Ein
   * Wechsel zwischen zwei eigenen Vereinen zaehlt in beiden Spalten.
   */
  get summary(): TransferSummaryRow[] {
    const rows: TransferSummaryRow[] = (
      ['transfer', 'release'] as TransferRequestType[]
    ).map((type) =>
      this._summarize(
        type,
        this.visibleRequests.filter((r) =>
          type === 'release'
            ? r.request_type === 'release'
            : r.request_type !== 'release'
        )
      )
    );
    rows.push(this._summarize('total', this.visibleRequests));
    return rows;
  }

  get showDirection(): boolean {
    return this.currentUserClubIds.length > 0;
  }

  private _summarize(
    key: TransferRequestType | 'total',
    requests: TransferRequest[]
  ): TransferSummaryRow {
    const own = (id: number | undefined) =>
      id != null && this.currentUserClubIds.includes(id);
    const granted = requests.filter((r) => this._isGranted(r)).length;
    const open = requests.filter(
      (r) => !this._isGranted(r) && OPEN_STATUSES.includes(r.status)
    ).length;
    return {
      key,
      outgoing: requests.filter((r) => own(r.former_club?.id)).length,
      incoming: requests.filter((r) => own(r.requesting_club?.id)).length,
      open,
      granted,
      failed: requests.length - granted - open,
      total: requests.length,
    };
  }

  private _isGranted(r: TransferRequest): boolean {
    return (
      !!r.lv_approved_at && r.status !== 'withdrawn' && r.status !== 'expired'
    );
  }

  /**
   * Vorgänge, die der Landesverband genehmigt hat und die nicht nachträglich
   * annulliert wurden — Grundlage der Gebührenabrechnung, die einmal am
   * Saisonende läuft.
   *
   * Maßgeblich ist `lv_approved_at` und nicht der Status: Eine Spielerfreigabe,
   * die später widerrufen wurde, steht auf `revoked` und fiel damit aus der
   * Ausfuhr — obwohl sie erteilt war und die Gebühr ausgelöst hat. Der Widerruf
   * lässt Genehmigungszeitpunkt und genehmigendes Konto ausdrücklich stehen,
   * die Angabe ist also belastbar.
   *
   * `withdrawn` und `expired` fallen trotz gesetztem `lv_approved_at` heraus:
   * `cancel` und `TransferRequest.end_for_deactivated_club` lassen den
   * Zeitstempel stehen, wenn sie einen bereits terminierten Vorgang annullieren
   * — der Wechsel hat dann nie stattgefunden, und eine Gebühr dafür wäre
   * schlicht falsch.
   *
   * Enthalten ist dagegen `scheduled`: beschlossen und genehmigt, nur das
   * Wirksamkeitsdatum steht noch aus. Ob dafür schon abgerechnet wird,
   * entscheidet der Verband — die Statusspalte der CSV weist die Zeile aus.
   * Das ist der Punkt dieser Auswahl: Was aus einem Vorgang wurde, steht in
   * der Datei, statt von einem Filter verschluckt zu werden.
   */
  get grantedRequests(): TransferRequest[] {
    return this.visibleRequests.filter((r) => this._isGranted(r));
  }

  exportCsv(): void {
    exportTransferCsv(this._transloco, 'transfers', this.grantedRequests);
  }

  get pendingRequests(): TransferRequest[] {
    return this.visibleRequests.filter(
      (r) =>
        r.status === 'pending_club' ||
        r.status === 'pending_player' ||
        r.status === 'pending_lv' ||
        r.status === 'scheduled'
    );
  }

  get completedRequests(): TransferRequest[] {
    return this.visibleRequests.filter(
      (r) =>
        r.status === 'approved' ||
        r.status === 'revoked' ||
        r.status === 'withdrawn' ||
        r.status === 'expired' ||
        r.status.startsWith('rejected')
    );
  }
}
