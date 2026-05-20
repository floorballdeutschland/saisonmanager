import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  NotificationService,
  PlayerChangeRequestService,
  SessionService,
} from '@floorball/core';
import { PlayerChangeRequest } from '@floorball/types';

@Component({
  templateUrl: './player-change-request-list.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerChangeRequestListComponent implements OnInit, OnDestroy {
  requests: PlayerChangeRequest[] = [];
  loading = false;
  permissions: { [key: string]: boolean } = {};
  rejectingId: number | null = null;
  rejectionReason = '';

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: PlayerChangeRequestService,
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.permissions = user?.permissions || {};
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
    this._service
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (requests) => {
          this.requests = requests;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  canApproveReject(): boolean {
    return this.permissions['approve_player_change_request'] === true;
  }

  approve(request: PlayerChangeRequest): void {
    this._service.approve(request.id).subscribe({
      next: (updated) => {
        this.replaceRequest(updated);
        this._notificationService.success('Korrektur übernommen', {
          autoClose: true,
          keepAfterRouteChange: false,
        });
        this._cdr.markForCheck();
      },
      error: () => {
        this._notificationService.error('Genehmigung fehlgeschlagen.', {
          autoClose: true,
          keepAfterRouteChange: false,
        });
        this._cdr.markForCheck();
      },
    });
  }

  startReject(id: number): void {
    this.rejectingId = id;
    this.rejectionReason = '';
    this._cdr.markForCheck();
  }

  cancelReject(): void {
    this.rejectingId = null;
    this.rejectionReason = '';
    this._cdr.markForCheck();
  }

  confirmReject(request: PlayerChangeRequest): void {
    if (!this.rejectionReason.trim()) return;
    this._service.reject(request.id, this.rejectionReason).subscribe({
      next: (updated) => {
        this.replaceRequest(updated);
        this.rejectingId = null;
        this.rejectionReason = '';
        this._notificationService.success('Antrag abgelehnt', {
          autoClose: true,
          keepAfterRouteChange: false,
        });
        this._cdr.markForCheck();
      },
      error: () => {
        this._notificationService.error('Ablehnung fehlgeschlagen.', {
          autoClose: true,
          keepAfterRouteChange: false,
        });
        this._cdr.markForCheck();
      },
    });
  }

  correctionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      birthdate: 'Geburtsdatum',
      first_name: 'Vorname',
      last_name: 'Nachname',
      names_swapped: 'Vor-/Nachname vertauscht',
      nationality: 'Nationalität',
    };
    return labels[type] ?? type;
  }

  private replaceRequest(updated: PlayerChangeRequest): void {
    const idx = this.requests.findIndex((r) => r.id === updated.id);
    if (idx >= 0)
      this.requests = [
        ...this.requests.slice(0, idx),
        updated,
        ...this.requests.slice(idx + 1),
      ];
  }
}
