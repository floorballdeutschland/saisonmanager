import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeGameDay } from '@floorball/types';

@Component({
  templateUrl: './referee-game-days.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeGameDaysComponent implements OnInit, OnDestroy {
  gameDays: RefereeGameDay[] = [];
  loading = true;
  confirmingId: number | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  confirm(gameDayId: number): void {
    this.confirmingId = gameDayId;
    this._refereeService
      .confirmGameDay(gameDayId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.gameDays = this.gameDays.map((gd) =>
            gd.id === gameDayId
              ? { ...gd, my_confirmed_at: res.confirmed_at }
              : gd
          );
          this.confirmingId = null;
          this._cdr.markForCheck();
          this._notificationService.success('Spieltag bestätigt.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: () => {
          this.confirmingId = null;
          this._cdr.markForCheck();
        },
      });
  }

  canConfirm(gd: RefereeGameDay): boolean {
    return !gd.my_confirmed_at && !gd.auto_confirmed;
  }

  confirmationStatus(gd: RefereeGameDay): string {
    if (gd.my_confirmed_at) return 'confirmed';
    if (gd.auto_confirmed) return 'auto';
    return 'pending';
  }

  formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private _load(): void {
    this._refereeService
      .getGameDays()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (days) => {
          this.gameDays = days;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }
}
