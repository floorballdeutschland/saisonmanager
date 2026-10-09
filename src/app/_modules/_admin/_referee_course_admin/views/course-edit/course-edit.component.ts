import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeCourseService } from '@floorball/core';
import {
  RefereeCourse,
  RefereeCourseFormat,
  RefereeCourseInput,
  RefereeCourseOptions,
  RefereeCourseType,
} from '@floorball/types';
import { TranslocoService } from '@jsverse/transloco';
import {
  centsToEuro,
  euroToCents,
  isoToLocalInput,
  localInputToIso,
} from '../../course-format';

interface SessionForm {
  starts_at: string;
  ends_at: string;
  format: 'in_person' | 'online';
  location: string;
  online_url: string;
}

/**
 * Kurs anlegen oder bearbeiten. Zeiten werden als Ortszeit eingegeben und als
 * ISO mit Zeitzone gespeichert; Beträge in Euro, gespeichert in Cent.
 */
@Component({
  templateUrl: './course-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseEditComponent implements OnInit, OnDestroy {
  courseId: number | null = null;
  options: RefereeCourseOptions | null = null;
  loading = false;
  saving = false;

  // Formularzustand
  title = '';
  courseType: RefereeCourseType = 'g';
  stateAssociationId: number | null = null;
  partnerIds: number[] = [];
  licenseLevelIds: number[] = [];
  format: RefereeCourseFormat = 'in_person';
  sessions: SessionForm[] = [emptySession()];
  onlinePlatform = '';
  registrationMode: 'open' | 'none' = 'open';
  minParticipants: number | null = null;
  maxParticipants: number | null = null;
  registrationOpensAt = '';
  registrationDeadline = '';
  cancellationDeadline = '';
  minAge: number | null = null;
  feeMember = '';
  feeNonMember = '';
  feeOnlyOnLicense = false;
  noShowBillable = false;
  billStateAssociation = false;
  feeNote = '';
  isPublic = true;
  contactEmail = '';
  description = '';
  prerequisitesNote = '';

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    this.courseId = id ? Number(id) : null;
    this.loading = true;
    forkJoin({
      options: this._service.options(),
      course: this.courseId ? this._service.get(this.courseId) : of(null),
    })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: ({ options, course }) => {
          this.options = options;
          if (course) {
            this.fill(course);
          } else if (options.state_associations.length === 1) {
            this.stateAssociationId = options.state_associations[0].id;
          }
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

  get isNational(): boolean {
    return this.stateAssociationId === null;
  }

  /** Der verantwortliche LV des Kurses, falls das Konto ihn nicht zuordnen darf. */
  currentStateAssociation: { id: number; name: string } | null = null;
  private _originalStateAssociationId: number | null | undefined = undefined;

  /**
   * Auswahl des verantwortlichen LV. Ein Partner-LV darf den Kurs bearbeiten,
   * den verantwortlichen LV aber nicht zuordnen. Er steht trotzdem in der
   * Liste (gesperrt), sonst wäre die Auswahl leer und ein Klick hängte den
   * Kurs versehentlich um.
   */
  get stateAssociationChoices(): {
    id: number;
    name: string;
    locked?: boolean;
  }[] {
    const list = this.options?.state_associations ?? [];
    const current = this.currentStateAssociation;
    if (current && !list.some((sa) => sa.id === current.id)) {
      return [{ ...current, locked: true }, ...list];
    }
    return list;
  }

  get stateAssociationLocked(): boolean {
    return this.stateAssociationChoices.some(
      (sa) => sa.locked && sa.id === this.stateAssociationId
    );
  }

  get partnerOptions(): { id: number; name: string }[] {
    return (this.options?.partner_state_associations ?? []).filter(
      (sa) => sa.id !== this.stateAssociationId
    );
  }

  addSession(): void {
    const last = this.sessions[this.sessions.length - 1];
    this.sessions = [
      ...this.sessions,
      { ...emptySession(), format: last?.format ?? 'in_person' },
    ];
  }

  removeSession(index: number): void {
    this.sessions = this.sessions.filter((_, i) => i !== index);
  }

  toggle(list: 'partnerIds' | 'licenseLevelIds', id: number, on: boolean) {
    const without = this[list].filter((x) => x !== id);
    this[list] = on ? [...without, id] : without;
  }

  /** Fristen aus dem ersten Termin vorschlagen (14 bzw. 7 Tage vorher). */
  suggestDeadlines(): void {
    const first = this.sessions
      .map((s) => s.starts_at)
      .filter((s) => !!s)
      .sort()[0];
    if (!first) return;
    const start = new Date(first);
    const at = (days: number) => {
      const d = new Date(start);
      d.setDate(d.getDate() - days);
      d.setHours(23, 59, 0, 0);
      return isoToLocalInput(d.toISOString());
    };
    if (!this.registrationDeadline) this.registrationDeadline = at(14);
    if (!this.cancellationDeadline) this.cancellationDeadline = at(7);
  }

  get feeError(): boolean {
    return (
      Number.isNaN(euroToCents(this.feeMember)) ||
      Number.isNaN(euroToCents(this.feeNonMember))
    );
  }

  get valid(): boolean {
    return (
      this.title.trim() !== '' &&
      !this.feeError &&
      this.sessions.every((s) => !!s.starts_at) &&
      (this.stateAssociationId !== null ||
        !!this.options?.national_allowed ||
        this._originalStateAssociationId === null)
    );
  }

  save(): void {
    if (!this.valid || this.saving) return;
    this.saving = true;
    const request = this.courseId
      ? this._service.update(this.courseId, this.payload())
      : this._service.create(this.payload());
    request.pipe(takeUntil(this._destroy$)).subscribe({
      next: (course) => {
        this.saving = false;
        this._notify.success(
          this._transloco.translate('refereeCourseAdmin.courses.saved')
        );
        this._router.navigate([
          '/',
          'verwaltung',
          'schiri-kurse-planung',
          course.id,
        ]);
      },
      // Die Meldung zeigt der ErrorInterceptor.
      error: () => {
        this.saving = false;
        this._cdr.markForCheck();
      },
    });
  }

  payload(): RefereeCourseInput {
    // Verantwortlichen LV und Partner nur mitschicken, wenn das Konto sie
    // ändern darf: Für einen Partner-LV lehnt die API das sonst ab.
    const ownerLocked =
      this.stateAssociationLocked ||
      (this._originalStateAssociationId === null &&
        !this.options?.national_allowed);
    return {
      title: this.title.trim(),
      course_type: this.courseType,
      ...(ownerLocked
        ? {}
        : {
            state_association_id: this.stateAssociationId,
            partner_state_association_ids: this.partnerIds,
          }),
      license_level_ids: this.licenseLevelIds,
      format: this.format,
      sessions: this.sessions.map((s) => ({
        starts_at: localInputToIso(s.starts_at) ?? '',
        ends_at: localInputToIso(s.ends_at),
        format: this.format === 'hybrid' ? s.format : null,
        location: s.location.trim() || null,
        online_url: s.online_url.trim() || null,
      })),
      online_platform: this.onlinePlatform.trim() || null,
      registration_mode: this.registrationMode,
      min_participants: this.minParticipants,
      max_participants: this.maxParticipants,
      registration_opens_at: localInputToIso(this.registrationOpensAt),
      registration_deadline: localInputToIso(this.registrationDeadline),
      cancellation_deadline: localInputToIso(this.cancellationDeadline),
      min_age: this.minAge,
      fee_member_cents: euroToCents(this.feeMember),
      fee_non_member_cents: euroToCents(this.feeNonMember),
      fee_only_on_license: this.feeOnlyOnLicense,
      no_show_billable: this.noShowBillable,
      bill_state_association: this.isNational && this.billStateAssociation,
      fee_note: this.feeNote.trim() || null,
      public: this.isPublic,
      contact_email: this.contactEmail.trim() || null,
      description: this.description.trim() || null,
      prerequisites_note: this.prerequisitesNote.trim() || null,
    };
  }

  private fill(course: RefereeCourse): void {
    this.title = course.title;
    this.courseType = course.course_type;
    this.stateAssociationId = course.state_association?.id ?? null;
    this.currentStateAssociation = course.state_association;
    this._originalStateAssociationId = this.stateAssociationId;
    this.partnerIds = [...course.partner_state_association_ids];
    this.licenseLevelIds = [...course.license_level_ids];
    this.format = course.format;
    this.sessions = course.sessions.length
      ? course.sessions.map((s) => ({
          starts_at: isoToLocalInput(s.starts_at),
          ends_at: isoToLocalInput(s.ends_at),
          format:
            s.format ?? (course.format === 'online' ? 'online' : 'in_person'),
          location: s.location ?? '',
          online_url: s.online_url ?? '',
        }))
      : [emptySession()];
    this.onlinePlatform = course.online_platform ?? '';
    this.registrationMode = course.registration_mode;
    this.minParticipants = course.min_participants;
    this.maxParticipants = course.max_participants;
    this.registrationOpensAt = isoToLocalInput(course.registration_opens_at);
    this.registrationDeadline = isoToLocalInput(course.registration_deadline);
    this.cancellationDeadline = isoToLocalInput(course.cancellation_deadline);
    this.minAge = course.min_age;
    this.feeMember = centsToEuro(course.fee_member_cents);
    this.feeNonMember = centsToEuro(course.fee_non_member_cents);
    this.feeOnlyOnLicense = course.fee_only_on_license;
    this.noShowBillable = course.no_show_billable;
    this.billStateAssociation = course.bill_state_association;
    this.feeNote = course.fee_note ?? '';
    this.isPublic = course.public;
    this.contactEmail = course.contact_email ?? '';
    this.description = course.description ?? '';
    this.prerequisitesNote = course.prerequisites_note ?? '';
  }
}

function emptySession(): SessionForm {
  return {
    starts_at: '',
    ends_at: '',
    format: 'in_person',
    location: '',
    online_url: '',
  };
}
