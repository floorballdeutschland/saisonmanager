import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { RefereeCourseSignupService } from '@floorball/core';
import {
  CourseSignupAnswers,
  PublicClub,
  RefereeCourseOffer,
} from '@floorball/types';
import {
  cleanAnswers,
  emptyAnswers,
  missingRequired,
} from '@floorball/referee-course-signup';

const GUARDIAN_AGE = 16;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Kursdetail mit Anmeldung ohne Konto. Die Anmeldung gilt erst nach dem Klick
 * auf den Link in der Bestätigungsmail; mit Lizenznummer geht dieser Link an
 * die beim Schiri hinterlegte Adresse.
 */
@Component({
  templateUrl: './public-course-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PublicCourseDetailComponent implements OnInit, OnDestroy {
  course: RefereeCourseOffer | null = null;
  clubs: PublicClub[] = [];
  state: 'loading' | 'form' | 'sent' | 'missing' = 'loading';
  busy = false;
  error: string | null = null;

  vorname = '';
  nachname = '';
  geburtsdatum = '';
  email = '';
  telefon = '';
  lizenznummer = '';
  clubId: number | null = null;
  billingAddress = '';
  guardianName = '';
  guardianEmail = '';
  consent = false;
  answers: CourseSignupAnswers = emptyAnswers([]);

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseSignupService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = Number(this._route.snapshot.paramMap.get('id'));
    this._service
      .publicCourse(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (course) => {
          this.course = course;
          this.answers = emptyAnswers(course.fields);
          if (course.license_levels.length === 1)
            this.answers.desired_license_level_id = course.license_levels[0].id;
          this.state = 'form';
          this._cdr.markForCheck();
          if (this.canRegister) this.loadClubs();
        },
        error: () => {
          this.state = 'missing';
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get canRegister(): boolean {
    return (
      !!this.course &&
      this.course.registration_mode === 'open' &&
      !this.course.registration_closed_reason
    );
  }

  /** Vereine des Kurs-LV zuerst, dann alle übrigen. */
  get sortedClubs(): PublicClub[] {
    const own = this.course?.state_association?.id;
    return [...this.clubs].sort((a, b) => {
      const ao = a.state_association_id === own ? 0 : 1;
      const bo = b.state_association_id === own ? 0 : 1;
      return ao - bo || a.name.localeCompare(b.name, 'de');
    });
  }

  get ageAtCourse(): number | null {
    if (!this.geburtsdatum || !this.course) return null;
    const birth = new Date(this.geburtsdatum);
    const start = this.course.starts_on
      ? new Date(this.course.starts_on)
      : new Date();
    let age = start.getFullYear() - birth.getFullYear();
    const birthday = new Date(birth);
    birthday.setFullYear(start.getFullYear());
    if (start < birthday) age--;
    return age;
  }

  /** Ohne Lizenznummer gilt die Person als neu; die API entscheidet endgültig. */
  get needsGuardian(): boolean {
    const age = this.ageAtCourse;
    return age !== null && age < GUARDIAN_AGE && !this.lizenznummer.trim();
  }

  get missing(): string[] {
    if (!this.course) return [];
    return missingRequired(this.course.fields, this.answers);
  }

  get valid(): boolean {
    if (!this.course) return false;
    if (!this.vorname.trim() || !this.nachname.trim() || !this.geburtsdatum)
      return false;
    if (!EMAIL.test(this.email.trim())) return false;
    if (this.needsGuardian) {
      if (!this.guardianName.trim() || !EMAIL.test(this.guardianEmail.trim()))
        return false;
    }
    return this.consent && this.missing.length === 0;
  }

  submit(): void {
    if (!this.course || !this.valid || this.busy) return;
    this.busy = true;
    this.error = null;
    this._service
      .publicRegister(this.course.id, {
        ...cleanAnswers(this.course.fields, this.answers),
        vorname: this.vorname.trim(),
        nachname: this.nachname.trim(),
        geburtsdatum: this.geburtsdatum,
        email: this.email.trim(),
        telefon: this.telefon.trim() || null,
        lizenznummer: this.lizenznummer.trim() || null,
        club_id: this.clubId,
        billing_address: this.clubId
          ? null
          : this.billingAddress.trim() || null,
        guardian_name: this.needsGuardian ? this.guardianName.trim() : null,
        guardian_email: this.needsGuardian ? this.guardianEmail.trim() : null,
        consent: this.consent,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.busy = false;
          this.state = 'sent';
          this._cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.busy = false;
          this.error =
            err.status === 429
              ? 'courseSignup.public.tooMany'
              : (err.error?.error ?? 'courseSignup.public.failed');
          this._cdr.markForCheck();
        },
      });
  }

  private loadClubs(): void {
    this._service
      .publicClubs()
      .pipe(takeUntil(this._destroy$))
      .subscribe((clubs) => {
        this.clubs = clubs;
        this._cdr.markForCheck();
      });
  }
}
