import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeChangeRequest } from '@floorball/types';

@Component({
  templateUrl: './referee-change-requests.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeChangeRequestsComponent implements OnInit, OnDestroy {
  requests: RefereeChangeRequest[] = [];
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' = 'pending';
  loading = false;
  busyId: number | null = null;
  // Ablehnung braucht eine Begründung, Genehmigung optional eine Notiz.
  noteById = new Map<number, string>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._refereeService
      .adminGetChangeRequests(this.status)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.requests = result;
          this.noteById.clear();
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  changeStatus(status: string): void {
    this.status = status as typeof this.status;
    this.load();
  }

  note(id: number): string {
    return this.noteById.get(id) || '';
  }

  setNote(id: number, value: string): void {
    this.noteById.set(id, value);
  }

  approve(request: RefereeChangeRequest): void {
    this.busyId = request.id;
    this._refereeService
      .adminApproveChangeRequest(request.id, this.note(request.id))
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => this._afterDecision('refereeAdmin.changeRequests.approved'),
        error: () => this._resetBusy(),
      });
  }

  reject(request: RefereeChangeRequest): void {
    const note = this.note(request.id).trim();
    if (!note) {
      this._notificationService.error(
        this._transloco.translate('refereeAdmin.changeRequests.noteRequired'),
        { autoClose: true, keepAfterRouteChange: false }
      );
      return;
    }

    this.busyId = request.id;
    this._refereeService
      .adminRejectChangeRequest(request.id, note)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => this._afterDecision('refereeAdmin.changeRequests.rejected'),
        error: () => this._resetBusy(),
      });
  }

  refereeLink(request: RefereeChangeRequest): string[] {
    return [
      '/',
      'verwaltung',
      'schiedsrichter',
      request.referee?.lizenznummer_display || String(request.referee_id),
    ];
  }

  private _afterDecision(messageKey: string): void {
    this.busyId = null;
    this._notificationService.success(this._transloco.translate(messageKey), {
      autoClose: true,
      keepAfterRouteChange: false,
    });
    this.load();
  }

  private _resetBusy(): void {
    this.busyId = null;
    this._cdr.markForCheck();
  }
}
