import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { RefereeCourseService } from '@floorball/core';
import { RefereeCourseOptions, RefereeCourseSummary } from '@floorball/types';

/** Kursplanung: Liste der Kurse, die das Konto verwalten darf. */
@Component({
  templateUrl: './course-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseIndexComponent implements OnInit, OnDestroy {
  courses: RefereeCourseSummary[] = [];
  loading = false;
  // Vergangene Kurse sind standardmäßig ausgeblendet, die Arbeit steckt in den
  // kommenden.
  showPast = false;
  options: RefereeCourseOptions | null = null;
  readonly origin = typeof window === 'undefined' ? '' : window.location.origin;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
    this._service
      .options()
      .pipe(takeUntil(this._destroy$))
      .subscribe((options) => {
        this.options = options;
        this._cdr.markForCheck();
      });
  }

  /** Öffentliche Kursseite eines LV, zum Verlinken. */
  publicUrl(stateAssociationId: number): string {
    return `${this.origin}/schiri-kurse?verband=${stateAssociationId}`;
  }

  /** iframe-Code für die Verbandsseite (statische Seite ohne Seitenleiste). */
  embedCode(stateAssociationId: number): string {
    return (
      `<iframe src="${this.origin}/kurse-einbettung/?verband=${stateAssociationId}" ` +
      `style="width:100%;min-height:600px;border:0" title="Schiedsrichterkurse"></iframe>`
    );
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    const from = this.showPast ? undefined : today();
    this._service
      .list({ from })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (courses) => {
          this.courses = courses;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  togglePast(value: boolean): void {
    this.showPast = value;
    this.load();
  }

  /** Mindestzahl gesetzt und noch nicht erreicht. */
  belowMinimum(course: RefereeCourseSummary): boolean {
    return (
      !!course.min_participants &&
      (course.taken_seats ?? 0) < course.min_participants &&
      course.status !== 'cancelled'
    );
  }

  waitlisted(course: RefereeCourseSummary): number {
    return course.registration_counts?.['waitlisted'] ?? 0;
  }
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
