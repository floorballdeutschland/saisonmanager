import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AssociationService, RefereeObservationService } from '@floorball/core';
import {
  RefereeObservation,
  RefereeObservationReport,
  RefereeObservationReportQuery,
  Season,
} from '@floorball/types';

type StatusFilter = 'visible' | 'hidden' | 'all';

/**
 * Alle Beobachtungsbögen, die das Konto in der Verwaltung sehen darf, mit
 * Filter, aufklappbarem Bogen und Export (CSV/Excel) der Auswahl oder aller
 * gefilterten Bögen. Welche Bögen das sind, entscheidet die API
 * (RefereeObservationPolicy#admin_scope), nicht diese Ansicht.
 */
@Component({
  templateUrl: './referee-observation-report-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeObservationReportIndexComponent
  implements OnInit, OnDestroy
{
  loading = false;
  loadError = false;
  exporting = false;
  exportError = false;

  data: RefereeObservationReport | null = null;
  seasons: Season[] = [];

  filterSeasonId = '';
  filterGameOperationId: number | null = null;
  filterCoachId: number | null = null;
  filterRefereeId: number | null = null;
  filterStatus: StatusFilter = 'visible';
  filterFrom = '';
  filterTo = '';

  /** Ausgewählte Bögen für den Export. */
  selected = new Set<number>();
  /** Aufgeklappte Bögen. */
  expanded = new Set<number>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _observationService: RefereeObservationService,
    private _associationService: AssociationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._associationService.seasons$
      .pipe(takeUntil(this._destroy$))
      .subscribe((seasons) => {
        this.seasons = [...(seasons ?? [])].sort((a, b) => b.id - a.id);
        this._cdr.markForCheck();
      });

    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get observations(): RefereeObservation[] {
    return this.data?.observations ?? [];
  }

  private _buildQuery(): RefereeObservationReportQuery {
    const query: RefereeObservationReportQuery = { status: this.filterStatus };
    if (this.filterSeasonId) query.season_id = this.filterSeasonId;
    if (this.filterGameOperationId != null)
      query.game_operation_id = this.filterGameOperationId;
    if (this.filterCoachId != null) query.coach_id = this.filterCoachId;
    if (this.filterRefereeId != null) query.referee_id = this.filterRefereeId;
    if (this.filterFrom) query.from = this.filterFrom;
    if (this.filterTo) query.to = this.filterTo;
    return query;
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    this._observationService
      .adminGetReport(this._buildQuery())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.data = result;
          // Eine Auswahl aus dem vorigen Filter bliebe sonst unsichtbar im
          // Export hängen.
          this.selected.clear();
          this.expanded.clear();
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loadError = true;
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  resetFilter(): void {
    this.filterSeasonId = '';
    this.filterGameOperationId = null;
    this.filterCoachId = null;
    this.filterRefereeId = null;
    this.filterStatus = 'visible';
    this.filterFrom = '';
    this.filterTo = '';
    this.load();
  }

  // ----- Auswahl und Aufklappen -----

  toggleSelected(id: number): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  get allSelected(): boolean {
    return (
      this.observations.length > 0 &&
      this.observations.every((o) => this.selected.has(o.id))
    );
  }

  toggleAll(): void {
    if (this.allSelected) this.selected.clear();
    else this.observations.forEach((o) => this.selected.add(o.id));
  }

  toggleExpanded(id: number): void {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
  }

  refereeNames(observation: RefereeObservation): string {
    return [...(observation.ratings ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((r) => r.referee_name)
      .filter((name): name is string => !!name)
      .join(', ');
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    const [year, month, day] = iso.split('-');
    return year && month && day ? `${day}.${month}.${year}` : iso;
  }

  // ----- Export -----

  export(format: 'csv' | 'xlsx'): void {
    this.exporting = true;
    this.exportError = false;
    this._observationService
      .adminExportReport(format, this._buildQuery(), [...this.selected])
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (blob) => {
          this._download(blob, `schiri-beobachtungen.${format}`);
          this.exporting = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.exportError = true;
          this.exporting = false;
          this._cdr.markForCheck();
        },
      });
  }

  private _download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }
}
