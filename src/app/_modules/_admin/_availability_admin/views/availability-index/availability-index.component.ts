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
  RefereeService,
  SeasonInfo,
  SettingsService,
} from '@floorball/core';
import {
  RefereeAvailabilityReferee,
  RefereeAvailabilityState,
  RefereeAvailabilityWeekend,
} from '@floorball/types';

interface WeekendTotals {
  available: number;
  assigned: number;
  unavailable: number;
}

@Component({
  templateUrl: './availability-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AvailabilityIndexComponent implements OnInit, OnDestroy {
  seasons: SeasonInfo[] = [];
  loading = false;
  seasonsLoading = true;

  filterSeasonId = '';
  filterDateFrom = '';
  filterDateTo = '';

  weekends: RefereeAvailabilityWeekend[] = [];
  referees: RefereeAvailabilityReferee[] = [];

  // Lizenzstufen-Filter
  licenseLevels: string[] = [];
  selectedLevels = new Set<string>();

  // Abgeleitete Anzeige (nach Lizenzstufen-Filter)
  displayReferees: RefereeAvailabilityReferee[] = [];
  totals: { [weekendKey: string]: WeekendTotals } = {};

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _settingsService: SettingsService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._settingsService
      .getSeasons()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.seasons = data.seasons;
          this.filterSeasonId = data.current_season_id.toString();
          this.seasonsLoading = false;
          this._cdr.markForCheck();
          this._load();
        },
        error: () => {
          this.seasonsLoading = false;
          this._cdr.markForCheck();
          this._load();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  applyFilter(): void {
    this._load();
  }

  toggleLevel(level: string): void {
    if (this.selectedLevels.has(level)) {
      this.selectedLevels.delete(level);
    } else {
      this.selectedLevels.add(level);
    }
    this._recompute();
    this._cdr.markForCheck();
  }

  isLevelSelected(level: string): boolean {
    return this.selectedLevels.has(level);
  }

  refereeName(r: RefereeAvailabilityReferee): string {
    return `${r.nachname}, ${r.vorname}`;
  }

  // 'YYYY-MM-DD' → 'DD.MM.'
  formatShortDate(iso: string): string {
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}.${parts[1]}.`;
  }

  cellClass(state: RefereeAvailabilityState | undefined): string {
    switch (state) {
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'available':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-fb-gray-100 text-fb-gray-500';
    }
  }

  cellGlyph(state: RefereeAvailabilityState | undefined): string {
    switch (state) {
      case 'assigned':
        return 'A';
      case 'available':
        return '✓';
      default:
        return '✕';
    }
  }

  stateLabel(state: RefereeAvailabilityState | undefined): string {
    switch (state) {
      case 'assigned':
        return this._transloco.translate(
          'availabilityAdmin.index.stateAssigned'
        );
      case 'available':
        return this._transloco.translate(
          'availabilityAdmin.index.stateAvailable'
        );
      default:
        return this._transloco.translate(
          'availabilityAdmin.index.stateUnavailable'
        );
    }
  }

  private _load(): void {
    this.loading = true;
    this._cdr.markForCheck();
    this._refereeService
      .adminGetAvailability({
        season_id: this.filterSeasonId || undefined,
        date_from: this.filterDateFrom || undefined,
        date_to: this.filterDateTo || undefined,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.weekends = data.weekends;
          this.referees = data.referees;
          this._initLevels();
          this._recompute();
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate('availabilityAdmin.index.loadError'),
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }

  private _initLevels(): void {
    const levels = new Set<string>();
    this.referees.forEach((r) => {
      if (r.lizenzstufe) levels.add(r.lizenzstufe);
    });
    this.licenseLevels = Array.from(levels).sort();
    // Standard: alle Stufen angezeigt.
    this.selectedLevels = new Set(this.licenseLevels);
  }

  private _recompute(): void {
    this.displayReferees = this.referees.filter(
      (r) => !r.lizenzstufe || this.selectedLevels.has(r.lizenzstufe)
    );

    const totals: { [key: string]: WeekendTotals } = {};
    this.weekends.forEach((w) => {
      totals[w.key] = { available: 0, assigned: 0, unavailable: 0 };
    });
    this.displayReferees.forEach((r) => {
      this.weekends.forEach((w) => {
        const state = r.states[w.key] ?? 'unavailable';
        totals[w.key][state] += 1;
      });
    });
    this.totals = totals;
  }
}
