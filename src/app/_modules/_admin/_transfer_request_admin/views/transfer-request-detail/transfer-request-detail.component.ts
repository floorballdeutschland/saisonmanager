import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, switchMap, takeUntil } from 'rxjs';
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
  standalone: false,
})
export class TransferRequestDetailComponent implements OnInit, OnDestroy {
  request?: TransferRequest;
  loading = false;
  actionPending = false;
  rejectionReason = '';
  showRejectForm = false;
  rejectTarget: 'club' | 'lv' | null = null;
  showRevokeForm = false;
  revocationReason = '';

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
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.currentUserClubIds = user?.club_ids || [];
          // Echter Admin-Boolean vom Backend – menu_item_league_admin ist auch
          // für SBK true und zeigte SBK-Usern fälschlich die Vereins-Freigabe.
          this.isAdmin = !!user?.permissions?.['admin'];
          this.isSbk = !!user?.permissions?.['menu_item_transfer_requests_sbk'];
          this._cdr.markForCheck();
        },
      });

    this._route.params
      .pipe(
        switchMap((params) => {
          this.loading = true;
          this._cdr.markForCheck();
          return this._transferService.get(parseInt(params['id'], 10));
        }),
        takeUntil(this._destroy$)
      )
      .subscribe({
        next: (result) => {
          this.request = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate(
              'transferRequestAdmin.notifications.detailLoadError'
            )
          );
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
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

  get canExecuteScheduled(): boolean {
    if (!this.request || this.request.status !== 'scheduled') return false;
    if (!this.isAdmin && !this.isSbk) return false;
    if (!this.request.effective_date) return true;
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return this.request.effective_date <= localDate;
  }

  get canRevokeRelease(): boolean {
    if (!this.request) return false;
    if (this.request.request_type !== 'release') return false;
    if (this.request.status !== 'approved') return false;
    return this.isAdmin || this.isSbk;
  }

  get canCancel(): boolean {
    if (!this.request) return false;
    if (!this.isAdmin && !this.isSbk) return false;
    return [
      'pending_club',
      'pending_player',
      'pending_lv',
      'scheduled',
    ].includes(this.request.status);
  }

  cancelTransfer(): void {
    if (!this.request) return;
    if (
      !confirm(
        this._transloco.translate(
          'transferRequestAdmin.notifications.cancelConfirm'
        )
      )
    )
      return;

    this.actionPending = true;
    this._transferService
      .cancel(this.request.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.request = updated;
          this.actionPending = false;
          this._notificationService.success(
            this._transloco.translate(
              'transferRequestAdmin.notifications.cancelled'
            )
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(
            (typeof err === 'string' ? err : err?.error?.error) ||
              this._transloco.translate(
                'transferRequestAdmin.notifications.cancelError'
              )
          );
          this.actionPending = false;
          this._cdr.markForCheck();
        },
      });
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
          this._notificationService.success(
            this._transloco.translate(
              updated.request_type === 'release'
                ? 'transferRequestAdmin.notifications.releaseConfirmed'
                : 'transferRequestAdmin.notifications.transferConfirmed'
            )
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(
            (typeof err === 'string' ? err : err?.error?.error) ||
              this._transloco.translate(
                'transferRequestAdmin.notifications.clubApprovalError'
              )
          );
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

  startRevoke(): void {
    this.revocationReason = '';
    this.showRevokeForm = true;
  }

  cancelRevoke(): void {
    this.showRevokeForm = false;
  }

  submitRevoke(): void {
    if (!this.request || !this.revocationReason.trim()) return;

    this.actionPending = true;
    this._transferService
      .revokeRelease(this.request.id, this.revocationReason)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.request = updated;
          this.showRevokeForm = false;
          this.actionPending = false;
          this._notificationService.success(
            this._transloco.translate(
              'transferRequestAdmin.notifications.releaseRevoked'
            )
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(
            (typeof err === 'string' ? err : err?.error?.error) ||
              this._transloco.translate(
                'transferRequestAdmin.notifications.revokeError'
              )
          );
          this.actionPending = false;
          this._cdr.markForCheck();
        },
      });
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
        this._notificationService.success(
          this._transloco.translate(
            updated.request_type === 'release'
              ? 'transferRequestAdmin.notifications.releaseRejected'
              : 'transferRequestAdmin.notifications.transferRejected'
          )
        );
        this._cdr.markForCheck();
      },
      error: (err) => {
        this._notificationService.error(
          (typeof err === 'string' ? err : err?.error?.error) ||
            this._transloco.translate(
              'transferRequestAdmin.notifications.rejectError'
            )
        );
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
            updated.request_type === 'release'
              ? this._transloco.translate(
                  'transferRequestAdmin.notifications.releaseGranted'
                )
              : updated.status === 'scheduled' && updated.effective_date
                ? this._transloco.translate(
                    'transferRequestAdmin.notifications.transferScheduled',
                    {
                      date: updated.effective_date
                        .split('-')
                        .reverse()
                        .join('.'),
                    }
                  )
                : this._transloco.translate(
                    'transferRequestAdmin.notifications.transferApprovedExecuted'
                  )
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(
            (typeof err === 'string' ? err : err?.error?.error) ||
              this._transloco.translate(
                'transferRequestAdmin.notifications.lvApprovalError'
              )
          );
          this.actionPending = false;
          this._cdr.markForCheck();
        },
      });
  }

  executeScheduled(): void {
    if (!this.request) return;
    this.actionPending = true;
    this._transferService
      .execute(this.request.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.request = updated;
          this.actionPending = false;
          this._notificationService.success(
            this._transloco.translate(
              'transferRequestAdmin.notifications.transferExecuted'
            )
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(
            (typeof err === 'string' ? err : err?.error?.error) ||
              this._transloco.translate(
                'transferRequestAdmin.notifications.executeError'
              )
          );
          this.actionPending = false;
          this._cdr.markForCheck();
        },
      });
  }

  back(): void {
    this._router.navigate(['/verwaltung/transfer-anfragen']);
  }

  statusLabel(status: string, requestType?: string): string {
    if (requestType === 'release') {
      const keys: { [key: string]: string } = {
        pending_club: 'statusPendingClub',
        pending_lv: 'statusReleasePendingLv',
        approved: 'statusReleaseApproved',
        rejected_by_club: 'statusRejectedByClub',
        rejected_by_lv: 'statusRejectedByLv',
        revoked: 'statusRevoked',
        expired: 'statusExpired',
      };
      return keys[status]
        ? this._transloco.translate(
            `transferRequestAdmin.detail.${keys[status]}`
          )
        : status;
    }
    const keys: { [key: string]: string } = {
      pending_club: 'statusPendingClub',
      pending_lv: 'statusPendingLv',
      scheduled: 'statusScheduled',
      approved: 'statusApproved',
      rejected_by_club: 'statusRejectedByClub',
      rejected_by_lv: 'statusRejectedByLv',
      expired: 'statusExpired',
    };
    return keys[status]
      ? this._transloco.translate(`transferRequestAdmin.detail.${keys[status]}`)
      : status;
  }

  statusClass(status: string): string {
    if (status === 'approved') return 'text-green-600 font-medium';
    if (status === 'scheduled') return 'text-yellow-600 font-medium';
    if (
      status.startsWith('rejected') ||
      status === 'revoked' ||
      status === 'expired'
    )
      return 'text-red-500 font-medium';
    return 'text-primary font-medium';
  }
}
