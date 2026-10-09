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
  RefereeCourseSignupService,
} from '@floorball/core';
import {
  CourseSignupAnswers,
  OwnCourseRegistration,
  RefereeCourseOffer,
} from '@floorball/types';
import { TranslocoService } from '@jsverse/transloco';
import {
  cleanAnswers,
  emptyAnswers,
  missingRequired,
} from '../../signup-answers';

/** Schiri-Portal: Kursangebote und eigene Anmeldungen. */
@Component({
  templateUrl: './portal-courses.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PortalCoursesComponent implements OnInit, OnDestroy {
  courses: RefereeCourseOffer[] = [];
  registrations: OwnCourseRegistration[] = [];
  ownStateAssociationId: number | null = null;
  onlyOwn = true;
  loading = true;
  busy = false;

  openId: number | null = null;
  answers: CourseSignupAnswers = emptyAnswers([]);

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseSignupService,
    private _notify: NotificationService,
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
    this._service
      .portal()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.courses = res.courses;
          this.registrations = res.registrations;
          this.ownStateAssociationId = res.own_state_association_id;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  /** Eigener LV: verantwortlich, Partner oder bundesweit. */
  get visibleCourses(): RefereeCourseOffer[] {
    if (!this.onlyOwn || this.ownStateAssociationId === null)
      return this.courses;
    const own = this.ownStateAssociationId;
    return this.courses.filter(
      (c) =>
        !c.state_association ||
        c.state_association.id === own ||
        c.partner_state_association_ids.includes(own)
    );
  }

  get activeRegistrations(): OwnCourseRegistration[] {
    return this.registrations.filter((r) => !r.status.startsWith('cancelled'));
  }

  open(course: RefereeCourseOffer): void {
    this.openId = course.id;
    this.answers = emptyAnswers(course.fields);
    if (course.license_levels.length === 1) {
      this.answers.desired_license_level_id = course.license_levels[0].id;
    }
  }

  missing(course: RefereeCourseOffer): string[] {
    return missingRequired(course.fields, this.answers);
  }

  register(course: RefereeCourseOffer): void {
    if (this.busy || this.missing(course).length) return;
    this.busy = true;
    this._service
      .portalRegister(course.id, cleanAnswers(course.fields, this.answers))
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (registration) => {
          this.busy = false;
          this.openId = null;
          this._notify.success(
            this._transloco.translate(
              registration.status === 'waitlisted'
                ? 'courseSignup.waitlisted'
                : 'courseSignup.registered'
            )
          );
          this.load();
        },
        // Die Meldung zeigt der ErrorInterceptor.
        error: () => {
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }

  courseFor(
    registration: OwnCourseRegistration
  ): RefereeCourseOffer | undefined {
    return this.courses.find((c) => c.id === registration.referee_course_id);
  }

  /** Abmeldung nach der Frist: Gebühr bleibt fällig, vorher warnen. */
  lateCancellation(registration: OwnCourseRegistration): boolean {
    const deadline = this.courseFor(registration)?.cancellation_deadline;
    return !!deadline && new Date(deadline) < new Date();
  }

  cancel(registration: OwnCourseRegistration): void {
    const key = this.lateCancellation(registration)
      ? 'courseSignup.confirmCancelLate'
      : 'courseSignup.confirmCancel';
    if (
      !confirm(
        this._transloco.translate(key, { course: registration.course_title })
      )
    )
      return;
    this.busy = true;
    this._service
      .portalCancel(registration.referee_course_id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.busy = false;
          this.load();
        },
        error: () => {
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }
}
