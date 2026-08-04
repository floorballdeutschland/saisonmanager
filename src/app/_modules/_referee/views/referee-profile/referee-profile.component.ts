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
  RefereeClubExclusionPayload,
  RefereeClubExclusionRequest,
  RefereeProfile,
} from '@floorball/types';

interface ExclusionRequestForm {
  kind: 'add' | 'remove';
  club_id: number | null;
  club_name?: string;
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
    // Die Ausschlussliste läuft über eigene Endpunkte und gehört nicht in den
    // Profil-PUT.
    delete draft.club_exclusions;
    delete draft.club_exclusion_requests;
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
