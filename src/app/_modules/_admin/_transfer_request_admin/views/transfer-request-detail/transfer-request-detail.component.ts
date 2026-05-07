import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  NotificationService,
  SessionService,
  TransferRequestService,
} from '@floorball/core';
import { TransferRequest } from '@floorball/types';

@Component({
  templateUrl: './transfer-request-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferRequestDetailComponent implements OnInit, OnDestroy {
  request?: TransferRequest;
  loading = false;
  actionPending = false;
  rejectionReason = '';
  showRejectForm = false;
  rejectTarget: 'club' | 'lv' | null = null;

  currentUserClubIds: number[] = [];
  isAdmin = false;
  isSbk = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.currentUserClubIds = user?.club_ids || [];
          this.isAdmin = !!user?.permissions?.['menu_item_league_admin'];
          this.isSbk = !!user?.permissions?.['menu_item_transfer_requests_sbk'];
          this._cdr.markForCheck();
        },
      });

    this._route.params.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      this.load(params['id']);
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(id: string): void {
    this.loading = true;
    this._transferService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.request = result.find((r) => r.id === parseInt(id, 10));
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  get canApproveClub(): boolean {
    if (!this.request || this.request.status !== 'pending_club') return false;
    return (
      this.isAdmin ||
      this.currentUserClubIds.includes(this.request.former_club.id)
    );
  }

  get canApproveLv(): boolean {
    if (!this.request || this.request.status !== 'pending_lv') return false;
    return this.isAdmin || this.isSbk;
  }

  approveClub(): void {
    if (!this.request) return;
    this.actionPending = true;
    this._transferService
      .approveClub(this.request.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.request = updated;
          this.actionPending = false;
          this._notificationService.success('Transferantrag bestätigt.');
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(err?.error?.error || 'Fehler.');
          this.actionPending = false;
          this._cdr.markForCheck();
        },
      });
  }

  startReject(target: 'club' | 'lv'): void {
    this.rejectTarget = target;
    this.rejectionReason = '';
    this.showRejectForm = true;
  }

  cancelReject(): void {
    this.showRejectForm = false;
    this.rejectTarget = null;
  }

  submitReject(): void {
    if (!this.request || !this.rejectionReason.trim() || !this.rejectTarget)
      return;

    this.actionPending = true;
    const obs =
      this.rejectTarget === 'club'
        ? this._transferService.rejectClub(
            this.request.id,
            this.rejectionReason
          )
        : this._transferService.rejectLv(this.request.id, this.rejectionReason);

    obs.pipe(takeUntil(this._destroy$)).subscribe({
      next: (updated) => {
        this.request = updated;
        this.showRejectForm = false;
        this.actionPending = false;
        this._notificationService.success('Transferantrag abgelehnt.');
        this._cdr.markForCheck();
      },
      error: (err) => {
        this._notificationService.error(err?.error?.error || 'Fehler.');
        this.actionPending = false;
        this._cdr.markForCheck();
      },
    });
  }

  approveLv(): void {
    if (!this.request) return;
    this.actionPending = true;
    this._transferService
      .approveLv(this.request.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.request = updated;
          this.actionPending = false;
          this._notificationService.success(
            'Transfer genehmigt und vollzogen.'
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(err?.error?.error || 'Fehler.');
          this.actionPending = false;
          this._cdr.markForCheck();
        },
      });
  }

  back(): void {
    this._router.navigate(['/verwaltung/transfer-anfragen']);
  }

  statusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      pending_club: 'Warten auf abgebenden Verein',
      pending_lv: 'Warten auf Landesverband',
      approved: 'Genehmigt – Transfer vollzogen',
      rejected_by_club: 'Abgelehnt durch abgebenden Verein',
      rejected_by_lv: 'Abgelehnt durch Landesverband',
    };
    return labels[status] || status;
  }

  statusClass(status: string): string {
    if (status === 'approved') return 'text-green-600 font-medium';
    if (status.startsWith('rejected')) return 'text-red-500 font-medium';
    return 'text-primary font-medium';
  }
}
