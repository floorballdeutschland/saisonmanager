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
  ClubCourseReferee,
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

const GUARDIAN_AGE = 16;

interface PersonForm {
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  email: string;
  club_id: number | null;
  guardian_name: string;
  guardian_email: string;
}

/**
 * Vereinsansicht: Angebote, Anmeldungen des Vereins und Sammelanmeldung
 * eigener Schiris oder neuer Personen.
 */
@Component({
  templateUrl: './club-courses.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ClubCoursesComponent implements OnInit, OnDestroy {
  courses: RefereeCourseOffer[] = [];
  registrations: OwnCourseRegistration[] = [];
  clubs: { id: number; name: string }[] = [];
  referees: ClubCourseReferee[] = [];
  loading = true;
  busy = false;
  showCancelled = false;

  openId: number | null = null;
  mode: 'referee' | 'person' = 'referee';
  refereeId: number | null = null;
  person: PersonForm = emptyPerson(null);
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
    this._service
      .clubReferees()
      .pipe(takeUntil(this._destroy$))
      .subscribe((referees) => {
        this.referees = referees;
        this._cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this._service
      .club()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.courses = res.courses;
          this.registrations = res.registrations;
          this.clubs = res.clubs;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  get visibleRegistrations(): OwnCourseRegistration[] {
    return this.registrations.filter(
      (r) => this.showCancelled || !r.status.startsWith('cancelled')
    );
  }

  registeredFor(course: RefereeCourseOffer): number {
    return this.registrations.filter(
      (r) =>
        r.referee_course_id === course.id && !r.status.startsWith('cancelled')
    ).length;
  }

  alreadyRegistered(course: RefereeCourseOffer, refereeId: number): boolean {
    return this.registrations.some(
      (r) =>
        r.referee_course_id === course.id &&
        r.referee_id === refereeId &&
        !r.status.startsWith('cancelled')
    );
  }

  open(course: RefereeCourseOffer): void {
    this.openId = course.id;
    this.mode = this.referees.length ? 'referee' : 'person';
    this.refereeId = null;
    this.person = emptyPerson(
      this.clubs.length === 1 ? this.clubs[0].id : null
    );
    this.answers = emptyAnswers(course.fields);
    if (course.license_levels.length === 1) {
      this.answers.desired_license_level_id = course.license_levels[0].id;
    }
  }

  /** Alter am ersten Kurstag, wie die API rechnet. */
  ageAtCourse(course: RefereeCourseOffer): number | null {
    if (!this.person.geburtsdatum) return null;
    const birth = new Date(this.person.geburtsdatum);
    const start = course.starts_on ? new Date(course.starts_on) : new Date();
    let age = start.getFullYear() - birth.getFullYear();
    const birthday = new Date(birth);
    birthday.setFullYear(start.getFullYear());
    if (start < birthday) age--;
    return age;
  }

  needsGuardian(course: RefereeCourseOffer): boolean {
    const age = this.ageAtCourse(course);
    return this.mode === 'person' && age !== null && age < GUARDIAN_AGE;
  }

  canSubmit(course: RefereeCourseOffer): boolean {
    if (missingRequired(course.fields, this.answers).length) return false;
    if (this.mode === 'referee') return this.refereeId !== null;
    const p = this.person;
    if (!p.vorname.trim() || !p.nachname.trim() || !p.geburtsdatum)
      return false;
    if (!p.club_id) return false;
    if (this.needsGuardian(course))
      return !!p.guardian_name.trim() && !!p.guardian_email.trim();
    return true;
  }

  missing(course: RefereeCourseOffer): string[] {
    return missingRequired(course.fields, this.answers);
  }

  register(course: RefereeCourseOffer): void {
    if (this.busy || !this.canSubmit(course)) return;
    const base = cleanAnswers(course.fields, this.answers);
    const p = this.person;
    const payload =
      this.mode === 'referee'
        ? { ...base, referee_id: this.refereeId! }
        : {
            ...base,
            vorname: p.vorname.trim(),
            nachname: p.nachname.trim(),
            geburtsdatum: p.geburtsdatum,
            email: p.email.trim() || null,
            club_id: p.club_id,
            guardian_name: this.needsGuardian(course)
              ? p.guardian_name.trim()
              : null,
            guardian_email: this.needsGuardian(course)
              ? p.guardian_email.trim()
              : null,
          };
    this.busy = true;
    this._service
      .clubRegister(course.id, payload)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (registration) => {
          this.busy = false;
          const key =
            registration.status === 'pending_guardian'
              ? 'courseSignup.pendingGuardian'
              : registration.status === 'waitlisted'
                ? 'courseSignup.waitlisted'
                : 'courseSignup.registered';
          this._notify.success(this._transloco.translate(key));
          // Formular offen lassen: Die Sammelanmeldung geht meist weiter.
          this.open(course);
          this.load();
        },
        error: () => {
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }

  cancel(registration: OwnCourseRegistration): void {
    if (
      !confirm(
        this._transloco.translate('courseSignup.confirmCancelPerson', {
          name: `${registration.vorname} ${registration.nachname}`,
          course: registration.course_title,
        })
      )
    )
      return;
    this.busy = true;
    this._service
      .clubCancel(registration.id)
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

  euro(cents: number | null): string {
    return cents === null
      ? '–'
      : `${(cents / 100).toFixed(2).replace('.', ',')} €`;
  }
}

function emptyPerson(clubId: number | null): PersonForm {
  return {
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    email: '',
    club_id: clubId,
    guardian_name: '',
    guardian_email: '',
  };
}
