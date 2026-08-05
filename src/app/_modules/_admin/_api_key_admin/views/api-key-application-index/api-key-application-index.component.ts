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
import { ApiKeyApplicationService, NotificationService } from '@floorball/core';
import { ApiKeyApplication, ApiKeyApplicationStatus } from '@floorball/types';

/**
 * Anträge Außenstehender auf einen API-Zugang, zur Entscheidung durch die
 * Administration.
 *
 * Eine Genehmigung erzeugt noch keinen Key: Der Antragsteller bekommt einen
 * Einmal-Link, über den der Key beim Abholen entsteht und genau einmal angezeigt
 * wird. Solange nichts abgeholt wurde, lässt sich der Link neu ausstellen.
 */
@Component({
  templateUrl: './api-key-application-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApiKeyApplicationIndexComponent implements OnInit, OnDestroy {
  applications: ApiKeyApplication[] = [];
  loading = false;
  statusFilter: ApiKeyApplicationStatus | '' = 'pending';

  /** Antrag, für den gerade eine Begründung eingegeben wird. */
  rejectingId: number | null = null;
  rejectionReason = '';
  /** Läuft eine Entscheidung, bleiben die Knöpfe dieses Antrags gesperrt. */
  busyIds = new Set<number>();
  expandedIds = new Set<number>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _applicationService: ApiKeyApplicationService,
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
    this._applicationService
      .getAll(this.statusFilter || undefined)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.applications = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._notificationService.error(
            this._transloco.translate('apiKeys.applications.loadError'),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  setStatusFilter(status: ApiKeyApplicationStatus | ''): void {
    this.statusFilter = status;
    this.load();
  }

  get pendingCount(): number {
    return this.applications.filter((a) => a.status === 'pending').length;
  }

  toggleDetails(application: ApiKeyApplication): void {
    if (this.expandedIds.has(application.id)) {
      this.expandedIds.delete(application.id);
    } else {
      this.expandedIds.add(application.id);
    }
    this._cdr.markForCheck();
  }

  approve(application: ApiKeyApplication): void {
    if (this.busyIds.has(application.id)) return;
    this.busyIds.add(application.id);

    this._applicationService
      .approve(application.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.busyIds.delete(application.id);
          this._notificationService.success(
            this._transloco.translate('apiKeys.applications.approved', {
              organisation: application.organisation,
            }),
            { autoClose: true }
          );
          this.load();
        },
        error: () => {
          this.busyIds.delete(application.id);
          this._cdr.markForCheck();
        },
      });
  }

  startReject(application: ApiKeyApplication): void {
    this.rejectingId = application.id;
    this.rejectionReason = '';
    this._cdr.markForCheck();
  }

  cancelReject(): void {
    this.rejectingId = null;
    this.rejectionReason = '';
    this._cdr.markForCheck();
  }

  confirmReject(application: ApiKeyApplication): void {
    const reason = this.rejectionReason.trim();
    if (!reason || this.busyIds.has(application.id)) return;

    this.busyIds.add(application.id);
    this._applicationService
      .reject(application.id, reason)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.busyIds.delete(application.id);
          this.cancelReject();
          this.load();
        },
        error: () => {
          this.busyIds.delete(application.id);
          this._cdr.markForCheck();
        },
      });
  }

  resendReveal(application: ApiKeyApplication): void {
    if (this.busyIds.has(application.id)) return;
    this.busyIds.add(application.id);

    this._applicationService
      .resendReveal(application.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.busyIds.delete(application.id);
          this._notificationService.success(
            this._transloco.translate('apiKeys.applications.revealResent', {
              email: application.email,
            }),
            { autoClose: true }
          );
          this.load();
        },
        error: () => {
          this.busyIds.delete(application.id);
          this._cdr.markForCheck();
        },
      });
  }

  /** Ein neuer Abhol-Link hilft nur, solange der Key nicht abgeholt wurde. */
  canResendReveal(application: ApiKeyApplication): boolean {
    return application.status === 'approved' && !application.key_revealed_at;
  }
}
