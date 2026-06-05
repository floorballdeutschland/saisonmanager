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
  RefereeCourseImportService,
} from '@floorball/core';
import {
  RefereeCourseMasterFields,
  RefereeCourseResult,
} from '@floorball/types';

@Component({
  templateUrl: './course-review-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseReviewIndexComponent implements OnInit, OnDestroy {
  results: RefereeCourseResult[] = [];
  loading = false;
  // Pro Result lokaler Edit-Buffer für Stammdaten (Master-Final).
  editBuffers = new Map<number, Partial<RefereeCourseMasterFields>>();
  approving = new Set<number>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseImportService,
    private _notify: NotificationService,
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
    this._service
      .listPendingResults()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.results = result;
          this.editBuffers.clear();
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this._notify.error(
            err?.error?.error ?? 'Offene Vorgänge konnten nicht geladen werden'
          );
          this._cdr.markForCheck();
        },
      });
  }

  bufferFor(id: number): Partial<RefereeCourseMasterFields> {
    if (!this.editBuffers.has(id)) this.editBuffers.set(id, {});
    return this.editBuffers.get(id)!;
  }

  setField<K extends keyof RefereeCourseMasterFields>(
    result: RefereeCourseResult,
    field: K,
    value: RefereeCourseMasterFields[K]
  ): void {
    const buf = this.bufferFor(result.id);
    buf[field] = value;
  }

  approve(result: RefereeCourseResult): void {
    const buf = this.editBuffers.get(result.id);
    this.approving.add(result.id);

    this._service
      .approveResult(
        result.id,
        buf && Object.keys(buf).length ? buf : undefined
      )
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.results = this.results.filter((r) => r.id !== result.id);
          this.editBuffers.delete(result.id);
          this.approving.delete(result.id);
          this._notify.success('Freigegeben');
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.approving.delete(result.id);
          this._notify.error(err?.error?.error ?? 'Freigabe fehlgeschlagen');
          this._cdr.markForCheck();
        },
      });
  }

  trackResult(_: number, r: RefereeCourseResult): number {
    return r.id;
  }
}
