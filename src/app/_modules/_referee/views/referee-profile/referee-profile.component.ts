import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { NotificationService, RefereeService } from '@floorball/core';
import {
  ExclusionClub,
  RefereeChangeRequest,
  RefereeChangeRequestPayload,
  RefereeClubExclusionPayload,
  RefereeClubExclusionRequest,
  RefereeCorrectionType,
  RefereeProfile,
  RefereeProfileQualification,
} from '@floorball/types';
import { isGermanDateExpired } from 'src/app/_helpers/_utils/german-date';

interface ExclusionRequestForm {
  kind: 'add' | 'remove';
  club_id: number | null;
  club_name?: string;
  reason: string;
}

interface CorrectionForm {
  correction_type: RefereeCorrectionType;
  new_value: string;
  new_club_id: number | null;
  reason: string;
}

@Component({
  templateUrl: './referee-profile.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeProfileComponent implements OnInit, OnDestroy {
  profile?: RefereeProfile;
  draft: Partial<RefereeProfile> = {};
  loading = false;
  saving = false;

  // Vereins-Ausschlussliste: eigener Block innerhalb der Ansetzungsangaben mit
  // eigenen Endpunkten, deshalb bewusst außerhalb von draft/submit().
  clubs: ExclusionClub[] = [];
  requestForm: ExclusionRequestForm | null = null;
  exclusionBusy = false;

  // Stammdaten-Korrekturen: Name, Geburtsdatum und Verein sind gesperrt und
  // werden über einen Antrag an die RSK des Landesverbands geändert.
  correctionForm: CorrectionForm | null = null;
  correctionBusy = false;
  readonly correctionFields: RefereeCorrectionType[] = [
    'vorname',
    'nachname',
    'geburtsdatum',
    'verein',
  ];

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this._refereeService
      .getProfile()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (p) => {
          this.profile = p;
          this.draft = this._toDraft(p);
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'refereeSelf.notifications.profileLoadError'
            ),
            {
              autoClose: false,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Zusatzqualifikationen samt Gueltigkeit. Rein lesend: Gepflegt werden sie von
  // der Schiedsrichterkommission, die API nimmt sie im Profil-Update nicht an.
  get qualifications(): RefereeProfileQualification[] {
    return this.profile?.qualifications || [];
  }

  // Abgelaufene Qualifikationen bleiben stehen und werden rot gezeichnet; ohne
  // hinterlegten Ablauf gibt es keine Aussage (siehe isGermanDateExpired).
  qualificationExpired(validUntil?: string | null): boolean {
    return isGermanDateExpired(validUntil);
  }

  get openRequests(): RefereeClubExclusionRequest[] {
    return (this.profile?.club_exclusion_requests || []).filter(
      (r) => r.status === 'pending'
    );
  }

  // Vereine, die noch nicht auf der Liste stehen und für die kein Antrag offen
  // ist – nur die sind sinnvoll beantragbar. Bei unveränderter Auswahl wird die
  // bisherige Liste zurückgegeben, damit das Suchfeld nicht bei jeder
  // Change-Detection eine neue Referenz sieht.
  get selectableClubs(): ExclusionClub[] {
    const listed = new Set(
      (this.profile?.club_exclusions || []).map((e) => e.club_id)
    );
    const pending = new Set(this.openRequests.map((r) => r.club_id));
    const next = this.clubs.filter(
      (c) => !listed.has(c.id) && !pending.has(c.id)
    );
    const cache = this._selectableClubsCache;
    if (
      next.length !== cache.length ||
      next.some((c, i) => c.id !== cache[i].id)
    ) {
      this._selectableClubsCache = next;
    }
    return this._selectableClubsCache;
  }

  private _selectableClubsCache: ExclusionClub[] = [];

  pendingFor(clubId: number): boolean {
    return this.openRequests.some((r) => r.club_id === clubId);
  }

  startRequest(kind: 'add' | 'remove', clubId?: number): void {
    const entry = (this.profile?.club_exclusions || []).find(
      (e) => e.club_id === clubId
    );
    this.requestForm = {
      kind,
      club_id: clubId ?? null,
      club_name: entry?.club_name,
      reason: '',
    };
    if (kind === 'add' && this.clubs.length === 0) {
      this._loadClubs();
    }
  }

  cancelRequest(): void {
    this.requestForm = null;
  }

  canSubmitRequest(): boolean {
    return !!(
      this.requestForm &&
      this.requestForm.club_id &&
      this.requestForm.reason.trim()
    );
  }

  submitRequest(): void {
    if (!this.requestForm || !this.canSubmitRequest()) return;

    this.exclusionBusy = true;
    this._refereeService
      .createClubExclusionRequest({
        club_id: this.requestForm.club_id as number,
        kind: this.requestForm.kind,
        reason: this.requestForm.reason.trim(),
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (payload) => {
          this._applyExclusionPayload(payload);
          this.requestForm = null;
          this.exclusionBusy = false;
          this._cdr.markForCheck();
          this._notificationService.success(
            this._transloco.translate(
              'refereeSelf.notifications.exclusionRequested'
            ),
            { autoClose: true, keepAfterRouteChange: false }
          );
        },
        error: () => {
          this.exclusionBusy = false;
          this._cdr.markForCheck();
        },
      });
  }

  withdrawRequest(id: number): void {
    this.exclusionBusy = true;
    this._refereeService
      .withdrawClubExclusionRequest(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (payload) => {
          this._applyExclusionPayload(payload);
          this.exclusionBusy = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.exclusionBusy = false;
          this._cdr.markForCheck();
        },
      });
  }

  get openChangeRequests(): RefereeChangeRequest[] {
    return (this.profile?.change_requests || []).filter(
      (r) => r.status === 'pending'
    );
  }

  // Entschiedene und zurückgezogene Anträge als Verlauf, damit die
  // Rückmeldung der Kommission im Profil nachlesbar bleibt.
  get decidedChangeRequests(): RefereeChangeRequest[] {
    return (this.profile?.change_requests || []).filter(
      (r) => r.status !== 'pending'
    );
  }

  pendingCorrectionFor(type: RefereeCorrectionType): boolean {
    return this.openChangeRequests.some((r) => r.correction_type === type);
  }

  // Felder, für die noch kein Antrag offen ist. Als Getter, damit die Zeile
  // „Korrektur beantragen für:" ganz verschwindet, sobald für alle vier ein
  // Antrag läuft, statt als Beschriftung ohne Knöpfe stehen zu bleiben.
  get correctableFields(): RefereeCorrectionType[] {
    return this.correctionFields.filter((f) => !this.pendingCorrectionFor(f));
  }

  // Das Geburtsdatum kommt aus der API als ISO-Wert, im gesperrten Feld darüber
  // steht es aber deutsch. Ohne diese Umformung stünden im selben Block
  // „23.08.1990" und „1990-08-23" untereinander.
  correctionValueDisplay(
    request: RefereeChangeRequest,
    value?: string | null
  ): string {
    if (!value) return '';
    if (request.correction_type !== 'geburtsdatum') return value;

    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
  }

  // Deutsche Feldbezeichnung der API nicht durchreichen: In der englischen
  // Oberfläche stünde sonst „Geburtsdatum" mitten im englischen Text.
  correctionFieldKey(request: RefereeChangeRequest): string {
    return 'refereeSelf.profile.correctionField.' + request.correction_type;
  }

  correctionStatusKey(request: RefereeChangeRequest): string {
    return 'refereeSelf.profile.correctionStatus.' + request.status;
  }

  // Alle aktiven Vereine außer dem eigenen: Ein Antrag auf den Verein, in dem
  // die Person schon ist, würde nichts ändern und die API weist ihn ab.
  // Verglichen wird die ID und nicht der Name, sonst fiele bei zwei
  // gleichnamigen Vereinen der falsche aus der Auswahl.
  get correctionClubs(): ExclusionClub[] {
    const ownId = this.profile?.club_id;
    const next = this.clubs.filter((c) => c.id !== ownId);
    const cache = this._correctionClubsCache;
    if (
      next.length !== cache.length ||
      next.some((c, i) => c.id !== cache[i].id)
    ) {
      this._correctionClubsCache = next;
    }
    return this._correctionClubsCache;
  }

  private _correctionClubsCache: ExclusionClub[] = [];

  startCorrection(type: RefereeCorrectionType): void {
    this.correctionForm = {
      correction_type: type,
      new_value: '',
      new_club_id: null,
      reason: '',
    };
    if (type === 'verein' && this.clubs.length === 0) {
      this._loadClubs();
    }
  }

  cancelCorrection(): void {
    this.correctionForm = null;
  }

  canSubmitCorrection(): boolean {
    if (!this.correctionForm) return false;
    return this.correctionForm.correction_type === 'verein'
      ? !!this.correctionForm.new_club_id
      : !!this.correctionForm.new_value.trim();
  }

  // Die Antragsfelder liegen im Profil-Formular. Ohne diesen Abfangjäger löst
  // Enter dort die Formularabsendung aus: Das Profil würde gespeichert und
  // gemeldet, der Antrag aber nie gestellt.
  submitCorrectionFromKey(event: Event): void {
    event.preventDefault();
    this.submitCorrection();
  }

  submitCorrection(): void {
    if (!this.correctionForm || !this.canSubmitCorrection()) return;

    const form = this.correctionForm;
    this.correctionBusy = true;
    this._refereeService
      .createChangeRequest({
        correction_type: form.correction_type,
        new_value:
          form.correction_type === 'verein' ? undefined : form.new_value.trim(),
        new_club_id:
          form.correction_type === 'verein'
            ? (form.new_club_id as number)
            : undefined,
        reason: form.reason.trim() || undefined,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (payload) => {
          this._applyChangeRequestPayload(payload);
          // Nur schließen, wenn noch dasselbe Formular offen steht: Wer
          // während des Absendens abbricht und ein zweites Feld öffnet, soll
          // dieses nicht durch die eintreffende Antwort verlieren.
          if (this.correctionForm === form) this.correctionForm = null;
          this.correctionBusy = false;
          this._cdr.markForCheck();
          this._notificationService.success(
            this._transloco.translate(
              'refereeSelf.notifications.correctionRequested'
            ),
            { autoClose: true, keepAfterRouteChange: false }
          );
        },
        error: () => {
          this.correctionBusy = false;
          this._cdr.markForCheck();
        },
      });
  }

  withdrawCorrection(id: number): void {
    this.correctionBusy = true;
    this._refereeService
      .withdrawChangeRequest(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (payload) => {
          this._applyChangeRequestPayload(payload);
          this.correctionBusy = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.correctionBusy = false;
          this._cdr.markForCheck();
        },
      });
  }

  private _applyChangeRequestPayload(
    payload: RefereeChangeRequestPayload
  ): void {
    if (!this.profile) return;

    this.profile = {
      ...this.profile,
      change_requests: payload.change_requests,
    };
  }

  private _applyExclusionPayload(payload: RefereeClubExclusionPayload): void {
    if (!this.profile) return;

    this.profile = {
      ...this.profile,
      club_exclusions: payload.club_exclusions,
      club_exclusion_requests: payload.club_exclusion_requests,
    };
  }

  private _loadClubs(): void {
    this._refereeService
      .getExclusionClubs()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (clubs) => {
          this.clubs = clubs;
          this._cdr.markForCheck();
        },
      });
  }

  // E-Mail und Name bleiben außen vor und sind nur read-only sichtbar; die API
  // ignoriert die Felder beim Speichern ohnehin. Die E-Mail wird unter „Mein
  // Konto" per Double-Opt-In gepflegt, der Name ausschließlich über die
  // Schiedsrichterverwaltung, weil er auf dem Ausweis steht.
  private _toDraft(p: RefereeProfile): Partial<RefereeProfile> {
    const draft: Partial<RefereeProfile> = { ...p };
    delete draft.email;
    delete draft.account_email;
    delete draft.vorname;
    delete draft.nachname;
    // Ausschlussliste und Korrekturanträge laufen über eigene Endpunkte und
    // gehören nicht in den Profil-PUT.
    delete draft.club_exclusions;
    delete draft.club_exclusion_requests;
    delete draft.change_requests;
    return draft;
  }

  submit(): void {
    this.saving = true;
    this._refereeService
      .updateProfile(this.draft)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (p) => {
          this.profile = p;
          this.draft = this._toDraft(p);
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.success(
            this._transloco.translate('refereeSelf.notifications.profileSaved'),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'refereeSelf.notifications.profileSaveError'
            ),
            {
              autoClose: false,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }
}
