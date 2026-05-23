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
import {
  NotificationService,
  SessionService,
  TransferRequestService,
} from '@floorball/core';
import { TransferRequest } from '@floorball/types';

@Component({
  templateUrl: './transfer-request-list.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          this._notificationService.error(
            'Transferanträge konnten nicht geladen werden.'
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

  canWithdraw(r: TransferRequest): boolean {
    return (
      (r.status === 'pending_club' || r.status === 'pending_lv') &&
      this.currentUserClubIds.includes(r.requesting_club.id)
    );
  }

  withdraw(r: TransferRequest, event: Event): void {
    event.stopPropagation();
    if (!confirm('Antrag wirklich zurückziehen?')) return;

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
          this._notificationService.success('Antrag zurückgezogen.', {
            autoClose: true,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this.withdrawingId = null;
          this._notificationService.error('Fehler beim Zurückziehen.', {
            autoClose: false,
          });
          this._cdr.markForCheck();
        },
      });
  }

  statusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      pending_club: 'Warten auf abgebenden Verein',
      pending_lv: 'Warten auf Landesverband',
      scheduled: 'Transfer geplant',
      approved: 'Genehmigt',
      rejected_by_club: 'Abgelehnt (Verein)',
      rejected_by_lv: 'Abgelehnt (LV)',
      revoked: 'Freigabe zurückgezogen',
      withdrawn: 'Zurückgezogen',
    };
    return labels[status] || status;
  }

  statusClass(status: string): string {
    if (status === 'approved') return 'text-green-600 font-medium';
    if (status === 'scheduled') return 'text-yellow-600 font-medium';
    if (
      status.startsWith('rejected') ||
      status === 'revoked' ||
      status === 'withdrawn'
    )
      return 'text-red-500';
    return 'text-primary font-medium';
  }

  typeLabel(r: TransferRequest): string {
    return r.request_type === 'release' ? 'Freigabe' : 'Transfer';
  }

  typeClass(r: TransferRequest): string {
    return r.request_type === 'release'
      ? 'text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800'
      : 'text-xs font-semibold px-1.5 py-0.5 rounded bg-fb-gray-200 text-fb-gray-500';
  }

  get canInitiate(): boolean {
    return this.currentUserClubIds.length > 0;
  }

  get approvedRequests(): TransferRequest[] {
    return this.requests.filter((r) => r.status === 'approved');
  }

  exportCsv(): void {
    const headers = [
      'Nachname',
      'Vorname',
      'Geburtsdatum',
      'Typ',
      'Abgebender Verein',
      'Aufnehmender Verein',
      'Genehmigt am',
    ];
    const rows = this.approvedRequests.map((r) => [
      r.player.last_name,
      r.player.first_name,
      r.player.birthdate ? this._formatDate(r.player.birthdate) : '',
      this.typeLabel(r),
      r.former_club.name,
      r.requesting_club.name,
      r.lv_approved_at ? this._formatDate(r.lv_approved_at) : '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
      )
      .join('\r\n');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfers-${yyyy}-${mm}-${dd}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  private _formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
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
      (r) =>
        r.status === 'approved' ||
        r.status === 'revoked' ||
        r.status === 'withdrawn' ||
        r.status.startsWith('rejected')
    );
  }
}
