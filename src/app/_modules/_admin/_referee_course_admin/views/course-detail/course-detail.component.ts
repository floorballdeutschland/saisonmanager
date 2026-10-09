import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import {
  ClubService,
  NotificationService,
  RefereeCourseService,
  RefereeService,
} from '@floorball/core';
import {
  Club,
  REFEREE_COURSE_TRANSITIONS,
  RefereeAdmin,
  RefereeCourse,
  RefereeCourseField,
  RefereeCourseOptions,
  RefereeCourseRegistration,
  RefereeCourseRegistrationInput,
  RefereeCourseStatus,
} from '@floorball/types';
import { TranslocoService } from '@jsverse/transloco';
import { CourseFieldChange } from '../../components/course-field-editor/course-field-editor.component';
import { centsToEuro } from '../../course-format';
import { downloadBlob } from 'src/app/_helpers/_utils/result-tile';

interface NewPerson {
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  email: string;
  club_id: number | null;
  desired_license_level_id: number | null;
}

/**
 * Ein Kurs in der Verwaltung: Eckdaten, Status, Zusatzfelder und
 * Teilnehmerliste. In Paket 1 trägt die RSK Teilnehmende selbst ein.
 */
@Component({
  templateUrl: './course-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseDetailComponent implements OnInit, OnDestroy {
  course: RefereeCourse | null = null;
  options: RefereeCourseOptions | null = null;
  registrations: RefereeCourseRegistration[] = [];
  clubs: Club[] = [];
  loading = false;
  busy = false;
  showCancelled = false;

  // Teilnehmende hinzufügen
  addMode: 'referee' | 'person' | null = null;
  refereeQuery = '';
  refereeResults: RefereeAdmin[] = [];
  newPerson: NewPerson = emptyPerson();
  overCapacity = false;

  readonly centsToEuro = centsToEuro;

  private _search$ = new Subject<string>();
  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseService,
    private _refereeService: RefereeService,
    private _clubService: ClubService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = Number(this._route.snapshot.paramMap.get('id'));
    this.loading = true;
    forkJoin({
      course: this._service.get(id),
      options: this._service.options(),
      registrations: this._service.listRegistrations(id),
    })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: ({ course, options, registrations }) => {
          this.course = course;
          this.options = options;
          this.registrations = registrations;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });

    this._search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) =>
          q.trim().length < 2 ? of([]) : this._refereeService.adminGetAll({ q })
        ),
        takeUntil(this._destroy$)
      )
      .subscribe({
        next: (results) => {
          this.refereeResults = results.slice(0, 10);
          this._cdr.markForCheck();
        },
        error: () => {
          this.refereeResults = [];
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // --- Anzeige -------------------------------------------------------------

  /** Statuswechsel von Hand; „eingereicht“ geht nur über submitResults. */
  get transitions(): RefereeCourseStatus[] {
    return this.course
      ? REFEREE_COURSE_TRANSITIONS[this.course.status].filter(
          (s) => s !== 'results_submitted'
        )
      : [];
  }

  get submissionProblems(): string[] {
    return this.course?.submission_problems ?? [];
  }

  /** Ergebnisse an FD zur Lizenzvergabe. Danach ist der Kurs gesperrt. */
  submitResults(): void {
    if (
      !this.course ||
      this.submissionProblems.length ||
      !confirm(
        this._transloco.translate(
          'refereeCourseAdmin.courseDetail.confirmSubmit'
        )
      )
    )
      return;
    this.run(this._service.submitResults(this.course.id), (course) => {
      this.course = course;
      this._notify.success(
        this._transloco.translate('refereeCourseAdmin.courseDetail.submitted', {
          count: course.submitted_results,
        })
      );
      this.reloadRegistrations();
    });
  }

  get editable(): boolean {
    return (
      !!this.course &&
      ['draft', 'published', 'registration_closed', 'held'].includes(
        this.course.status
      )
    );
  }

  get visibleRegistrations(): RefereeCourseRegistration[] {
    return this.registrations.filter(
      (r) => this.showCancelled || !r.status.startsWith('cancelled')
    );
  }

  get cancelledCount(): number {
    return this.registrations.filter((r) => r.status.startsWith('cancelled'))
      .length;
  }

  get seated(): number {
    return this.registrations.filter((r) =>
      ['registered', 'attended', 'no_show'].includes(r.status)
    ).length;
  }

  get full(): boolean {
    return (
      !!this.course?.max_participants &&
      this.seated >= this.course.max_participants
    );
  }

  get courseLevels(): { id: number; name: string }[] {
    const ids = this.course?.license_level_ids ?? [];
    return (this.options?.license_levels ?? []).filter((l) =>
      ids.includes(l.id)
    );
  }

  levelName(id: number | null): string {
    if (id === null) return '–';
    return this.options?.license_levels.find((l) => l.id === id)?.name ?? '–';
  }

  answer(registration: RefereeCourseRegistration, field: RefereeCourseField) {
    const value = registration.custom_answers[String(field.id)];
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean')
      return this._transloco.translate(
        value
          ? 'refereeCourseAdmin.courseDetail.yes'
          : 'refereeCourseAdmin.courseDetail.no'
      );
    return String(value);
  }

  /** Teilnehmerliste als CSV (Kontaktdaten, Zusatzfelder) für die Orga. */
  downloadParticipants(): void {
    if (!this.course) return;
    const course = this.course;
    this._service
      .participantsCsv(course.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe((blob) => downloadBlob(blob, `teilnehmende-${course.id}.csv`));
  }

  // --- Status ----------------------------------------------------------------

  changeStatus(status: RefereeCourseStatus): void {
    if (!this.course) return;
    if (
      status === 'cancelled' &&
      !confirm(
        this._transloco.translate(
          'refereeCourseAdmin.courseDetail.confirmCancel'
        )
      )
    )
      return;
    this.run(this._service.update(this.course.id, { status }), (course) => {
      this.course = course;
    });
  }

  deleteCourse(): void {
    if (
      !this.course ||
      !confirm(
        this._transloco.translate(
          'refereeCourseAdmin.courseDetail.confirmDelete'
        )
      )
    )
      return;
    this.run(this._service.delete(this.course.id), () =>
      this._router.navigate(['/', 'verwaltung', 'schiri-kurse-planung'])
    );
  }

  // --- Felder ----------------------------------------------------------------

  createField(field: RefereeCourseField): void {
    if (!this.course) return;
    this.run(this._service.createField(this.course.id, field), () =>
      this.reloadCourse()
    );
  }

  updateField(change: CourseFieldChange): void {
    if (!this.course) return;
    this.run(
      this._service.updateField(this.course.id, change.id, change.changes),
      () => this.reloadCourse()
    );
  }

  removeField(field: RefereeCourseField): void {
    if (!this.course || field.id === undefined) return;
    this.run(this._service.deleteField(this.course.id, field.id), () =>
      this.reloadCourse()
    );
  }

  // --- Teilnehmende ----------------------------------------------------------

  openAdd(mode: 'referee' | 'person'): void {
    this.addMode = mode;
    this.refereeQuery = '';
    this.refereeResults = [];
    // distinctUntilChanged soll dieselbe Suche nach dem Schließen wieder
    // durchlassen.
    this._search$.next('');
    this.newPerson = emptyPerson();
    this.overCapacity = false;
    if (mode === 'person' && this.clubs.length === 0) {
      this._clubService
        .getAdminClubAll(true)
        .pipe(takeUntil(this._destroy$))
        .subscribe((clubs) => {
          this.clubs = [...clubs].sort((a, b) =>
            a.name.localeCompare(b.name, 'de')
          );
          this._cdr.markForCheck();
        });
    }
  }

  searchReferees(q: string): void {
    this.refereeQuery = q;
    this._search$.next(q);
  }

  alreadyRegistered(refereeId: number): boolean {
    return this.registrations.some(
      (r) => r.referee_id === refereeId && !r.status.startsWith('cancelled')
    );
  }

  addReferee(referee: RefereeAdmin): void {
    this.addRegistration({ referee_id: referee.id });
  }

  get newPersonValid(): boolean {
    const p = this.newPerson;
    return !!p.vorname.trim() && !!p.nachname.trim() && !!p.geburtsdatum;
  }

  addPerson(): void {
    if (!this.newPersonValid) return;
    const p = this.newPerson;
    this.addRegistration({
      vorname: p.vorname.trim(),
      nachname: p.nachname.trim(),
      geburtsdatum: p.geburtsdatum,
      email: p.email.trim() || null,
      club_id: p.club_id,
      desired_license_level_id: p.desired_license_level_id,
    });
  }

  updateRegistration(
    registration: RefereeCourseRegistration,
    changes: RefereeCourseRegistrationInput
  ): void {
    if (!this.course) return;
    this.run(
      this._service.updateRegistration(
        this.course.id,
        registration.id,
        changes
      ),
      (updated) => {
        this.replace(updated);
        // Die offenen Punkte fürs Einreichen hängen an der Teilnehmerliste.
        if (this.course?.status === 'held') this.reloadCourse();
      },
      // Abgelehnt: die Zeile neu setzen, damit Auswahl und Felder wieder den
      // gespeicherten Wert zeigen (ngModel schreibt sonst nicht zurück).
      () => this.replace({ ...registration })
    );
  }

  pointsChanged(registration: RefereeCourseRegistration, value: string) {
    const text = value.trim().replace(',', '.');
    const points = text === '' ? null : Number(text);
    if (points !== null && Number.isNaN(points)) {
      this.replace({ ...registration });
      return;
    }
    if (points === registration.points) return;
    this.updateRegistration(registration, { points });
  }

  cancelRegistration(registration: RefereeCourseRegistration): void {
    if (
      !this.course ||
      !confirm(
        this._transloco.translate(
          'refereeCourseAdmin.courseDetail.confirmRemove',
          {
            name: `${registration.vorname} ${registration.nachname}`,
          }
        )
      )
    )
      return;
    this.run(
      this._service.cancelRegistration(this.course.id, registration.id),
      () => this.reloadRegistrations()
    );
  }

  private addRegistration(input: RefereeCourseRegistrationInput): void {
    if (!this.course) return;
    this.run(
      this._service.createRegistration(this.course.id, {
        ...input,
        over_capacity: this.overCapacity || undefined,
      }),
      (registration) => {
        this.registrations = [...this.registrations, registration];
        this.addMode = null;
        if (registration.status === 'waitlisted') {
          this._notify.warning(
            this._transloco.translate(
              'refereeCourseAdmin.courseDetail.waitlisted'
            )
          );
        }
      }
    );
  }

  private replace(updated: RefereeCourseRegistration): void {
    this.registrations = this.registrations.map((r) =>
      r.id === updated.id ? updated : r
    );
  }

  reloadCourse(): void {
    if (!this.course) return;
    this._service
      .get(this.course.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe((course) => {
        this.course = course;
        this._cdr.markForCheck();
      });
  }

  private reloadRegistrations(): void {
    if (!this.course) return;
    this._service
      .listRegistrations(this.course.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe((registrations) => {
        this.registrations = registrations;
        this._cdr.markForCheck();
      });
  }

  /** Eine Schreibaktion mit Sperre; Fehlermeldungen zeigt der Interceptor. */
  private run<T>(
    request: Observable<T>,
    done: (value: T) => void,
    failed?: () => void
  ): void {
    this.busy = true;
    request.pipe(takeUntil(this._destroy$)).subscribe({
      next: (value) => {
        this.busy = false;
        done(value);
        this._cdr.markForCheck();
      },
      error: () => {
        this.busy = false;
        failed?.();
        this._cdr.markForCheck();
      },
    });
  }

  /** Wartende Anmeldungen (E-Mail/Eltern) stellt die Verwaltung nicht um. */
  isPending(registration: RefereeCourseRegistration): boolean {
    return registration.status.startsWith('pending');
  }
}

function emptyPerson(): NewPerson {
  return {
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    email: '',
    club_id: null,
    desired_license_level_id: null,
  };
}
