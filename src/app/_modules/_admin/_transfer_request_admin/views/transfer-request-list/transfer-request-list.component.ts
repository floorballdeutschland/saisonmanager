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
  NotificationService,
  SessionService,
  TransferRequestService,
} from '@floorball/core';
import { TransferRequest } from '@floorball/types';
import {
  exportTransferCsv,
  transferStatusClass,
  transferStatusLabel,
  transferTypeClass,
  transferTypeLabel,
} from '../../transfer-request-presentation';

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

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _sessionService: SessionService,
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

  toggleAllSeasons(): void {
    this.allSeasons = !this.allSeasons;
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading = true;
    this._cdr.markForCheck();
    this._transferService
      .getAll(this.allSeasons)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.requests = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate(
              'transferRequestAdmin.notifications.loadError'
            )
          );
          this.loading = false;
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

  get approvedRequests(): TransferRequest[] {
    return this.requests.filter((r) => r.status === 'approved');
  }

  exportCsv(): void {
    exportTransferCsv(this._transloco, 'transfers', this.approvedRequests);
  }

  get pendingRequests(): TransferRequest[] {
    return this.requests.filter(
      (r) =>
        r.status === 'pending_club' ||
        r.status === 'pending_player' ||
        r.status === 'pending_lv' ||
        r.status === 'scheduled'
    );
  }

  get completedRequests(): TransferRequest[] {
    return this.requests.filter(
      (r) =>
        r.status === 'approved' ||
        r.status === 'revoked' ||
        r.status === 'withdrawn' ||
        r.status === 'expired' ||
        r.status.startsWith('rejected')
    );
  }
}
