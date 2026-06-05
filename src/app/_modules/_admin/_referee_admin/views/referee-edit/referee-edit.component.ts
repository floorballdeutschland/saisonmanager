import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import {
  AssociationService,
  ClubService,
  NotificationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import {
  Club,
  RefereeLicenseLevel,
  RefereeAdmin,
  RefereeQualificationEntry,
  RefereeQualificationType,
  StateAssociation,
} from '@floorball/types';

@Component({
  templateUrl: './referee-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeEditComponent implements OnInit, OnDestroy {
  referee: Partial<RefereeAdmin> = {};
  editMode = false;
  loading = false;
  saving = false;
  walletLoading = false;
  userAccountLoading = false;
  userDeleteLoading = false;
  isRestricted = false;
  canDelete = false;
  canMerge = false;
  canCreateUserAccount = false;
  canDeleteUserAccount = false;
  canIssueWallet = false;
  stateAssociations: StateAssociation[] = [];
  clubs: Club[] = [];
  qualificationTypes: RefereeQualificationType[] = [];
  qualifications: RefereeQualificationEntry[] = [];
  availableTypesList: RefereeQualificationType[][] = [];
  licenseLevels: RefereeLicenseLevel[] = [];

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _sessionService: SessionService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.isRestricted = !!user?.permissions['referee_edit_restricted'];
          this.canDelete = !this.isRestricted;
          this.canMerge = !!user?.permissions['referee_merge'];
          this.canCreateUserAccount = !!user?.permissions['referee_can_create'];
          this.canDeleteUserAccount =
            !!user?.permissions['referee_can_delete_user'];
          this.canIssueWallet = !!user?.permissions['referee_wallet'];
          this._cdr.markForCheck();
        },
      });

    this._associationService.stateAssociations$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.stateAssociations = result;
          this._cdr.markForCheck();
        },
      });

    forkJoin([
      this._clubService.getAdminClubAll(),
      this._refereeService.adminGetQualificationTypes(),
      this._refereeService.adminGetLicenseLevels(),
    ])
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: ([clubs, types, levels]) => {
          this.clubs = clubs.sort((a, b) => a.name.localeCompare(b.name));
          this.qualificationTypes = types.filter((t) => t.active);
          this.licenseLevels = levels.filter((l) => l.active);
          this._recomputeAvailableTypes();
          this._cdr.markForCheck();
        },
      });

    const param: string = this._route.snapshot.params['lizenznummer'];
    if (!param) {
      this._refereeService
        .adminGetNextLizenznummer()
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (res) => {
            // Nur vorbefüllen, wenn der Nutzer noch nichts eingegeben hat
            // (Antwort kann nach manueller Eingabe eintreffen).
            if (this.referee.lizenznummer) return;
            this.referee = {
              ...this.referee,
              lizenznummer: res.next_lizenznummer,
            };
            this._cdr.markForCheck();
          },
        });
    }
    if (param) {
      this.editMode = true;
      this.loading = true;

      if (param.startsWith('G-')) {
        const id = parseInt(param.slice(2), 10);
        this._refereeService
          .adminGetById(id)
          .pipe(takeUntil(this._destroy$))
          .subscribe({
            next: (r) => this._applyReferee(r),
            error: () => this._handleLoadError(),
          });
      } else {
        const lizenznummer = parseInt(param, 10);
        this._refereeService
          .adminGetAll({ q: param })
          .pipe(takeUntil(this._destroy$))
          .subscribe({
            next: (results) => {
              const match = results.find(
                (r) => r.lizenznummer === lizenznummer
              );
              if (match) {
                this._refereeService
                  .adminGetById(match.id)
                  .pipe(takeUntil(this._destroy$))
                  .subscribe({
                    next: (r) => this._applyReferee(r),
                    error: () => this._handleLoadError(),
                  });
              } else {
                this.loading = false;
                this._cdr.markForCheck();
              }
            },
            error: () => this._handleLoadError(),
          });
      }
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  hasLicenseLevel(name: string): boolean {
    return this.licenseLevels.some((l) => l.name === name);
  }

  get derivedLandesverband(): string {
    if (!this.referee.club_id) return '';
    const club = this.clubs.find((c) => c.id === this.referee.club_id);
    if (!club?.state_association_id) return '';
    const sa = this.stateAssociations.find(
      (s) => s.id === club.state_association_id
    );
    return sa?.name ?? '';
  }

  addQualification(): void {
    const usedTypeIds = new Set(
      this.qualifications.map((q) => q.qualification_type_id)
    );
    const nextType = this.qualificationTypes.find(
      (t) => !usedTypeIds.has(t.id)
    );
    if (!nextType) return;
    this.qualifications = [
      ...this.qualifications,
      { qualification_type_id: nextType.id },
    ];
    this._recomputeAvailableTypes();
  }

  removeQualification(index: number): void {
    this.qualifications = this.qualifications.filter((_, i) => i !== index);
    this._recomputeAvailableTypes();
  }

  onQualificationTypeChange(): void {
    this._recomputeAvailableTypes();
  }

  trackById(_index: number, item: { id: number }): number {
    return item.id;
  }

  submit(): void {
    if (!this.referee.vorname || !this.referee.nachname) return;
    if (!this.referee.guest && !this.referee.lizenznummer) {
      this._notificationService.error('Lizenznummer ist ein Pflichtfeld.', {
        autoClose: false,
        keepAfterRouteChange: false,
      });
      return;
    }

    this.saving = true;

    const payload: Partial<RefereeAdmin> & {
      qualifications?: RefereeQualificationEntry[];
    } = {
      ...this.referee,
      gueltigkeit: this._fromInputDate(this.referee.gueltigkeit),
      geburtsdatum: this._fromInputDate(this.referee.geburtsdatum),
      qualifications: this.qualifications.map((q) => ({
        ...q,
        valid_until: this._fromInputDate(q.valid_until),
      })),
    };

    const call =
      this.editMode && this.referee.id
        ? this._refereeService.adminUpdate(this.referee.id, payload)
        : this._refereeService.adminCreate(payload);

    call.pipe(takeUntil(this._destroy$)).subscribe({
      next: (saved) => {
        this._notificationService.success(
          this.editMode
            ? 'Schiedsrichter gespeichert.'
            : 'Schiedsrichter angelegt.',
          { autoClose: true, keepAfterRouteChange: true }
        );
        const detailId = saved.guest
          ? saved.lizenznummer_display
          : saved.lizenznummer;
        this._router.navigate(['/', 'verwaltung', 'schiedsrichter', detailId]);
      },
      error: () => {
        this.saving = false;
        this._cdr.markForCheck();
        this._notificationService.error('Fehler beim Speichern.', {
          autoClose: false,
          keepAfterRouteChange: false,
        });
      },
    });
  }

  delete(): void {
    if (!this.referee.id) return;
    if (
      !confirm(
        `Schiedsrichter ${this.referee.vorname} ${this.referee.nachname} wirklich löschen?`
      )
    )
      return;

    this._refereeService
      .adminDelete(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success('Schiedsrichter gelöscht.', {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
        },
        error: () => {
          this._notificationService.error('Fehler beim Löschen.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  createWalletPass(): void {
    if (!this.referee.id || this.referee.guest) return;
    this.walletLoading = true;
    this._refereeService
      .adminCreateWalletPass(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.referee = {
            ...this.referee,
            wallet_pass_issued_at: new Date().toISOString(),
            wallet_pass_url: result.url,
          };
          this.walletLoading = false;
          this._cdr.markForCheck();
          this._notificationService.success('Wallet-Ausweis ausgestellt.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: (err: HttpErrorResponse) => {
          this.walletLoading = false;
          this._cdr.markForCheck();
          const msg =
            typeof err?.error?.error === 'string'
              ? err.error.error
              : 'Wallet-Pass konnte nicht erstellt werden.';
          this._notificationService.error(msg, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  createUserAccount(): void {
    if (!this.referee.id) return;
    this.userAccountLoading = true;
    this._refereeService
      .adminCreateUserAccount(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.referee = {
            ...this.referee,
            user_id: updated.user_id,
            user_name: updated.user_name,
          };
          this.userAccountLoading = false;
          this._cdr.markForCheck();
          if (updated.duplicate_email) {
            this._notificationService.error(
              `Konto „${
                updated.user_name ?? ''
              }" angelegt, aber die E-Mail-Adresse ist bereits einem anderen Konto zugeordnet. Bitte E-Mail-Adresse prüfen.`,
              { autoClose: false, keepAfterRouteChange: false }
            );
          } else if (updated.email_sent === false) {
            this._notificationService.error(
              `Konto „${
                updated.user_name ?? ''
              }" angelegt, aber die E-Mail konnte nicht versendet werden. Bitte Passwort manuell zurücksetzen.`,
              { autoClose: false, keepAfterRouteChange: false }
            );
          } else {
            this._notificationService.success(
              `Konto „${
                updated.user_name ?? ''
              }" angelegt. Eine E-Mail mit dem Link zum Passwort-Setzen wurde verschickt.`,
              { autoClose: true, keepAfterRouteChange: false }
            );
          }
        },
        error: (err: HttpErrorResponse) => {
          this.userAccountLoading = false;
          this._cdr.markForCheck();
          const msg =
            err?.error?.errors?.[0] ??
            err?.error?.error ??
            'Fehler beim Anlegen des Benutzerkontos.';
          this._notificationService.error(msg, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  deleteUserAccount(): void {
    if (!this.referee.id || !this.referee.user_id) return;
    if (
      !confirm(
        `Benutzerkonto „${
          this.referee.user_name ?? ''
        }" wirklich löschen? Der Schiedsrichter kann sich danach nicht mehr anmelden.`
      )
    )
      return;

    this.userDeleteLoading = true;
    this._refereeService
      .adminDeleteUserAccount(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.referee = {
            ...this.referee,
            user_id: updated.user_id,
            user_name: updated.user_name,
          };
          this.userDeleteLoading = false;
          this._cdr.markForCheck();
          this._notificationService.success('Benutzerkonto gelöscht.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: (err: HttpErrorResponse) => {
          this.userDeleteLoading = false;
          this._cdr.markForCheck();
          const msg =
            err?.error?.errors?.[0] ??
            err?.error?.error ??
            'Fehler beim Löschen des Benutzerkontos.';
          this._notificationService.error(msg, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  private _applyReferee(r: RefereeAdmin): void {
    const { qualifications: _q, ...rest } = r;
    this.referee = {
      ...rest,
      gueltigkeit: this._toInputDate(r.gueltigkeit),
      geburtsdatum: this._toInputDate(r.geburtsdatum),
    };
    this.qualifications = (_q ?? []).map((q) => ({
      ...q,
      valid_until: this._toInputDate(q.valid_until),
    }));
    this._recomputeAvailableTypes();
    this.loading = false;
    this._cdr.markForCheck();
  }

  private _recomputeAvailableTypes(): void {
    this.availableTypesList = this.qualifications.map((_, i) => {
      const usedIds = new Set(
        this.qualifications
          .filter((_, j) => j !== i)
          .map((q) => q.qualification_type_id)
      );
      return this.qualificationTypes.filter((t) => !usedIds.has(t.id));
    });
  }

  private _handleLoadError(): void {
    this.loading = false;
    this._cdr.markForCheck();
    this._notificationService.error('Fehler beim Laden des Schiedsrichters.', {
      autoClose: false,
      keepAfterRouteChange: false,
    });
  }

  /** Convert DD.MM.YYYY (API) to YYYY-MM-DD (HTML date input) */
  private _toInputDate(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const parts = value.split('.');
    if (parts.length !== 3) return value;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  /** Convert YYYY-MM-DD (HTML date input) to DD.MM.YYYY (API) */
  private _fromInputDate(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
}
