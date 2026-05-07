import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SessionService, TransferRequestService } from '@floorball/core';
import { TransferRequest } from '@floorball/types';

@Component({
  templateUrl: './transfer-request-list.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferRequestListComponent implements OnInit, OnDestroy {
  requests: TransferRequest[] = [];
  loading = false;
  permissions: { [key: string]: boolean } = {};
  currentUserClubIds: number[] = [];

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _sessionService: SessionService,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.permissions = user?.permissions || {};
          this.currentUserClubIds = user?.club_ids || [];
          this._cdr.markForCheck();
        },
      });

    this.loadRequests();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  loadRequests(): void {
    this.loading = true;
    this._transferService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.requests = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
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

  statusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      pending_club: 'Warten auf abgebenden Verein',
      pending_lv: 'Warten auf Landesverband',
      scheduled: 'Transfer geplant',
      approved: 'Genehmigt',
      rejected_by_club: 'Abgelehnt (Verein)',
      rejected_by_lv: 'Abgelehnt (LV)',
    };
    return labels[status] || status;
  }

  statusClass(status: string): string {
    if (status === 'approved') return 'text-green-600 font-medium';
    if (status === 'scheduled') return 'text-yellow-400 font-medium';
    if (status.startsWith('rejected')) return 'text-red-500';
    return 'text-primary font-medium';
  }

  get canInitiate(): boolean {
    return this.currentUserClubIds.length > 0;
  }

  get pendingRequests(): TransferRequest[] {
    return this.requests.filter(
      (r) =>
        r.status === 'pending_club' ||
        r.status === 'pending_lv' ||
        r.status === 'scheduled'
    );
  }

  get completedRequests(): TransferRequest[] {
    return this.requests.filter(
      (r) => r.status === 'approved' || r.status.startsWith('rejected')
    );
  }
}
