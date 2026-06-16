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
import {
  NotificationService,
  SettingsService,
  SeasonInfo,
} from '@floorball/core';

@Component({
  templateUrl: './season-admin.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SeasonAdminComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  currentSeasonId: number | null = null;
  seasons: SeasonInfo[] = [];
  selectedSeasonId: number | null = null;
  confirmed = false;
  success = false;

  newSeasonName = '';
  creatingSeason = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _settingsService: SettingsService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._settingsService
      .getSeasons()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.currentSeasonId = data.current_season_id;
          this.seasons = data.seasons;
          this.selectedSeasonId = data.current_season_id;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get currentSeasonName(): string {
    return this.seasons.find((s) => s.id === this.currentSeasonId)?.name ?? '–';
  }

  get selectedSeasonName(): string {
    return (
      this.seasons.find((s) => s.id === this.selectedSeasonId)?.name ?? '–'
    );
  }

  get isChanging(): boolean {
    return (
      this.selectedSeasonId !== null &&
      this.selectedSeasonId !== this.currentSeasonId
    );
  }

  onSeasonChange(): void {
    this.confirmed = false;
    this.success = false;
    this._cdr.markForCheck();
  }

  createSeason(): void {
    const name = this.newSeasonName.trim();
    if (!name || this.creatingSeason) return;

    this.creatingSeason = true;
    this._settingsService
      .createSeason(name)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (season) => {
          this.seasons = [season, ...this.seasons];
          this.newSeasonName = '';
          this.creatingSeason = false;
          this._notificationService.success(
            this._transloco.translate('settings.notifications.seasonCreated', {
              name: season.name,
            }),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.creatingSeason = false;
          const msg =
            err?.error?.error ??
            this._transloco.translate('settings.notifications.createError');
          this._notificationService.error(msg, { autoClose: false });
          this._cdr.markForCheck();
        },
      });
  }

  submit(): void {
    if (
      !this.isChanging ||
      !this.confirmed ||
      this.saving ||
      this.selectedSeasonId === null
    )
      return;

    this.saving = true;
    this._settingsService
      .updateCurrentSeason(this.selectedSeasonId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.currentSeasonId = res.current_season_id;
          this.saving = false;
          this.confirmed = false;
          this.success = true;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          const msg =
            err?.error?.error ??
            this._transloco.translate('settings.notifications.switchError');
          this._notificationService.error(msg, { autoClose: false });
          this._cdr.markForCheck();
        },
      });
  }
}
