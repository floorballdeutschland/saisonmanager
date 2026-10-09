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
import { RefereeCourseSummary } from '@floorball/types';

/** „Meine Kurse" der Kursleitung. */
@Component({
  templateUrl: './lead-course-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LeadCourseIndexComponent implements OnInit, OnDestroy {
  courses: RefereeCourseSummary[] = [];
  loading = true;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._service
      .leadCourses()
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

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
