import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { RefereeCourseService } from '@floorball/core';
import {
  CourseLeadCourse,
  CourseLeadRegistration,
  RefereeCourseField,
} from '@floorball/types';

type LeadChange = Partial<
  Pick<CourseLeadRegistration, 'status' | 'result' | 'test_version' | 'points'>
>;

/**
 * Ein Kurs aus Sicht der Kursleitung: Termine (mit Online-Link), Teilnehmende
 * und die Erfassung von Anwesenheit und Testergebnis.
 */
@Component({
  templateUrl: './lead-course-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LeadCourseDetailComponent implements OnInit, OnDestroy {
  course: CourseLeadCourse | null = null;
  loading = true;
  busy = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = Number(this._route.snapshot.paramMap.get('id'));
    this._service
      .leadCourse(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (course) => {
          this.course = course;
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

  get seated(): CourseLeadRegistration[] {
    return (this.course?.registrations ?? []).filter(
      (r) => r.status !== 'waitlisted'
    );
  }

  get waitlisted(): CourseLeadRegistration[] {
    return (this.course?.registrations ?? []).filter(
      (r) => r.status === 'waitlisted'
    );
  }

  answer(r: CourseLeadRegistration, field: RefereeCourseField): string {
    const value = r.custom_answers[String(field.id)];
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  update(r: CourseLeadRegistration, change: LeadChange): void {
    if (!this.course) return;
    this.busy = true;
    this._service
      .leadUpdateRegistration(this.course.id, r.id, change)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          if (this.course) {
            this.course = {
              ...this.course,
              registrations: this.course.registrations.map((x) =>
                x.id === updated.id ? updated : x
              ),
            };
          }
          this.busy = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }

  pointsChanged(r: CourseLeadRegistration, value: string): void {
    const text = value.trim().replace(',', '.');
    const points = text === '' ? null : Number(text);
    if (points !== null && Number.isNaN(points)) return;
    if (points === r.points) return;
    this.update(r, { points });
  }

  testVersionChanged(r: CourseLeadRegistration, value: string): void {
    const testVersion = value.trim() || null;
    if (testVersion === r.test_version) return;
    this.update(r, { test_version: testVersion });
  }
}
