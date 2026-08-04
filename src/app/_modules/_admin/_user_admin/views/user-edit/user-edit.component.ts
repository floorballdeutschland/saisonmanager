import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  ClubService,
  UserManagementService,
  NotificationService,
  SessionService,
  GameOperationService,
} from '@floorball/core';
import {
  ClubWithTeams,
  Team,
  UserAdminEntry,
  UserAdminRole,
  User,
  GameOperation,
} from '@floorball/types';
import {
  ROLE_PERMISSION_FLAG,
  hasAssignRoleFlags,
} from '../../role-permission-flags';

@Component({
  templateUrl: './user-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class UserEditComponent implements OnInit, OnDestroy {
  user: UserAdminEntry | null = null;
  currentUser: User | null = null;
  email = '';
  saving = false;
  sendingReset = false;
  deleting = false;
  archiving = false;

  clubsWithTeams: ClubWithTeams[] = [];
  editableTeamIds: number[] = [];
  savingTeams = false;

  gameOperations: GameOperation[] = [];
  selectedGoId: number | null = null;
  selectedClubId: number | null = null;
  savingAssignment = false;

  // Mehrfachrollen-Verwaltung (Admin, SBK und RSK im Rahmen ihres Scopes,
  // siehe availableRoleOptions). Die Admin-Rolle (1) wird hier bewusst nie
  // angeboten.
  readonly roleOptions = [
    {
      id: 2,
      labelKey: 'userAdmin.create.roleSbk',
      needsGo: true,
      needsClub: false,
    },
    {
      id: 3,
      labelKey: 'userAdmin.create.roleRsk',
      needsGo: true,
      needsClub: false,
    },
    {
      id: 7,
      labelKey: 'userAdmin.create.roleAnsetzer',
      needsGo: true,
      needsClub: false,
    },
    {
      id: 4,
      labelKey: 'userAdmin.create.roleVm',
      needsGo: false,
      needsClub: true,
    },
    {
      id: 5,
      labelKey: 'userAdmin.create.roleTm',
      needsGo: false,
      needsClub: true,
    },
  ];
  newRoleId: number | null = null;
  newRoleGoId: number | null = null;
  newRoleClubId: number | null = null;
  managingRole = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _userService: UserManagementService,
    private _clubService: ClubService,
    private _gameOperationService: GameOperationService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
    private _transloco: TranslocoService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this._cdr.markForCheck();
      });

    const id = parseInt(this._route.snapshot.params['id'], 10);
    this._userService
      .getUser(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.user = user;
          this.email = user.email ?? '';
          this.editableTeamIds = user.teams ? [...user.teams] : [];

          const goScopedRole = user.roles?.find((r) =>
            [2, 3, 7].includes(r.user_group_id)
          );
          this.selectedGoId = goScopedRole?.game_operation_id ?? null;

          // Verein-Vorbelegung aus der Rollen-Berechtigung (VM/TM) statt aus der
          // ggf. abweichenden Spalte user.club_id – die Berechtigung ist die
          // Quelle der Wahrheit für den Verein. club_id kann dort als String
          // vorliegen, daher auf number normalisieren, damit die Dropdown-Option
          // (number) matcht und der Verein nicht fälschlich als "leer" erscheint.
          const clubScopedRole = user.roles?.find((r) =>
            [4, 5].includes(r.user_group_id)
          );
          const clubId = clubScopedRole?.club_id ?? user.club_id;
          const parsedClubId = clubId != null ? Number(clubId) : null;
          // Kein NaN in selectedClubId zulassen – sonst würde ein defekter
          // club_id-Wert beim Hauptspeichern als club_id: null serialisiert und
          // die Zuweisung ungewollt entfernen.
          this.selectedClubId =
            parsedClubId != null && !Number.isNaN(parsedClubId)
              ? parsedClubId
              : null;

          this._pruneUnassignableTeamIds();
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate('userAdmin.notifications.userNotFound'),
            {
              autoClose: false,
            }
          );
          this._router.navigate(['/', 'verwaltung', 'benutzer']);
        },
      });

    this._clubService
      .adminGetClubAndTeams()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.clubsWithTeams = data;
          this._pruneUnassignableTeamIds();
          this._cdr.markForCheck();
        },
      });

    this._gameOperationService
      .getAdminGameOperations()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.gameOperations = data;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Zugang zur Benutzerverwaltung: Admin, SBK und (seit der eigenen
  // Rollenvergabe) RSK. Was davon jemand tatsächlich zuweisen darf, sagen die
  // assign_role_*-Flags, nicht dieser Schalter.
  get isAdminOrSbk(): boolean {
    return !!this.currentUser?.permissions['menu_item_user_admin'];
  }

  // Vereinsgebundene Zuweisungen (Vereinswechsel, Tausch VM ↔ TM) darf nur, wer
  // diese Rollen auch vergeben darf: Eine reine RSK sieht die VM-/TM-Konten
  // ihres Verbands, der Server lehnt Änderungen daran aber ab.
  get canAssignClubRoles(): boolean {
    const permissions = this.currentUser?.permissions;
    if (!permissions) return false;
    // Sitzung von vor dem Rollout: Flags fehlen im localStorage, dann wie bisher.
    if (!('assign_role_vm' in permissions)) return this.isAdminOrSbk;

    return !!permissions['assign_role_vm'] && !!permissions['assign_role_tm'];
  }

  get canDelete(): boolean {
    return (
      !!this.currentUser?.permissions['user_delete'] &&
      this.user?.id !== this.currentUser?.id
    );
  }

  // Archivieren hängt an denselben Rechten wie das Bearbeiten (Admin/SBK
  // global, VM für die eigenen Vereinskonten); das eigene Konto ist gesperrt.
  get canArchive(): boolean {
    return !this.isSelf && (this.isAdminOrSbk || this.isVm);
  }

  get isVm(): boolean {
    return (
      !!this.currentUser?.permissions['menu_item_user_vm'] && !this.isAdminOrSbk
    );
  }

  get isSelf(): boolean {
    return this.user?.id === this.currentUser?.id;
  }

  get currentRoleId(): number | null {
    if (!this.user) return null;
    const vmOrTm = this.user.roles.find((r) =>
      [4, 5].includes(r.user_group_id)
    );
    return vmOrTm?.user_group_id ?? null;
  }

  get userPrimaryRoleId(): number | null {
    if (!this.user) return null;
    const role = this.user.roles?.find((r) =>
      [2, 3, 4, 5, 7].includes(r.user_group_id)
    );
    return role?.user_group_id ?? null;
  }

  get canChangeRole(): boolean {
    return (
      !this.isSelf &&
      this.currentRoleId !== null &&
      (this.canAssignClubRoles || this.isVm)
    );
  }

  get showGoAssignment(): boolean {
    const roleId = this.userPrimaryRoleId;
    return this.isAdminOrSbk && roleId !== null && [2, 3, 7].includes(roleId);
  }

  get showClubAssignment(): boolean {
    const roleId = this.userPrimaryRoleId;
    return (
      (this.canAssignClubRoles || this.isVm) &&
      !this.isSelf &&
      roleId !== null &&
      [4, 5].includes(roleId)
    );
  }

  get selectedClubName(): string {
    if (this.selectedClubId == null) return '–';
    return (
      this.clubsWithTeams.find((c) => c.id === this.selectedClubId)?.name ?? '–'
    );
  }

  get availableTeams(): Team[] {
    if (this.selectedClubId == null) return [];
    const club = this.clubsWithTeams.find((c) => c.id === this.selectedClubId);
    return club?.teams ?? [];
  }

  get showTeamAssignment(): boolean {
    return this.currentRoleId === 5 && this.availableTeams.length > 0;
  }

  isTeamSelected(teamId: number): boolean {
    return this.editableTeamIds.includes(teamId);
  }

  // Nach einem Vereinswechsel im Auswahlfeld zeigt die Teamliste die Teams des
  // neuen Vereins. Die bisherige Auswahl gehört zum alten und wäre nicht mehr
  // zuweisbar, würde aber weiter mitgesendet.
  onClubChange(): void {
    this._pruneUnassignableTeamIds();
  }

  // Zuweisungen, die nicht mehr zuweisbar sind (Mannschaft einer vergangenen
  // Saison, anderer Verein), haben in der Liste keine Checkbox und sind damit
  // unsichtbar. Blieben sie in der Auswahl, würde die API sie ablehnen und das
  // Speichern wäre blockiert, ohne dass der Haken abwählbar wäre. Deshalb beim
  // Laden der Teamliste auf das Anwählbare eindampfen: Der nächste Speichervorgang
  // räumt die toten Zuweisungen dann mit auf, was ohnehin das Ziel ist.
  private _pruneUnassignableTeamIds(): void {
    // Beide Quellen (Konto und Teamliste) laden parallel; ohne sie wäre jede
    // Auswahl scheinbar unzuweisbar und würde fälschlich verworfen.
    if (!this.user || !this.clubsWithTeams.length) return;

    const assignable = this.availableTeams.map((t) => t.id);
    this.editableTeamIds = this.editableTeamIds.filter((id) =>
      assignable.includes(id)
    );
  }

  private _teamSelectionChanged(): boolean {
    const saved = [...(this.user?.teams ?? [])].sort((a, b) => a - b);
    const selected = [...this.editableTeamIds].sort((a, b) => a - b);

    return (
      saved.length !== selected.length ||
      saved.some((id, index) => id !== selected[index])
    );
  }

  toggleTeam(teamId: number): void {
    const idx = this.editableTeamIds.indexOf(teamId);
    if (idx >= 0) {
      this.editableTeamIds = this.editableTeamIds.filter((t) => t !== teamId);
    } else {
      this.editableTeamIds = [...this.editableTeamIds, teamId];
    }
  }

  get canManageRoles(): boolean {
    return !!this.currentUser?.permissions['manage_user_roles'] && !this.isSelf;
  }

  // Weitere Rollen kann ein Schiedsrichter-Konto nicht bekommen, der Server
  // lehnt sie ab (User#referee_role_not_combined). Nur das Hinzufügen entfällt:
  // Die Rollenliste mit ihren Entfernen-Schaltflächen bleibt sichtbar, weil ein
  // Altkonto mit dieser Kombination genau darüber in Ordnung gebracht wird.
  get canAddRole(): boolean {
    return this.canManageRoles && !this.isRefereeAccount;
  }

  // Konto der Schiedsrichter-Selbstverwaltung (Rolle 6).
  get isRefereeAccount(): boolean {
    return !!this.user?.roles?.some((r) => r.user_group_id === 6);
  }

  // Rollen, die das angemeldete Konto vergeben darf. Quelle sind die
  // assign_role_*-Flags der API (User::ASSIGNABLE_ROLE_IDS), nicht eine eigene
  // Rollenlogik; der Server prüft dieselbe Tabelle beim Speichern. Sitzungen von
  // vor diesem Rollout tragen die Flags nicht im localStorage – dort bleibt es
  // beim bisherigen Verhalten (Admin sieht alles), bis zur nächsten Anmeldung.
  get availableRoleOptions(): typeof this.roleOptions {
    const permissions = this.currentUser?.permissions;
    if (!permissions) return [];
    if (!hasAssignRoleFlags(permissions)) return this.roleOptions;

    return this.roleOptions.filter(
      (opt) => !!permissions[ROLE_PERMISSION_FLAG[opt.id]]
    );
  }

  get newRoleNeedsGo(): boolean {
    return this.newRoleId !== null && [2, 3, 7].includes(this.newRoleId);
  }

  get newRoleNeedsClub(): boolean {
    return this.newRoleId !== null && [4, 5].includes(this.newRoleId);
  }

  get canSubmitNewRole(): boolean {
    if (this.managingRole || this.newRoleId === null) return false;
    if (this.newRoleNeedsGo && !this.newRoleGoId) return false;
    if (this.newRoleNeedsClub && !this.newRoleClubId) return false;
    return true;
  }

  addRole(): void {
    if (!this.user || !this.canSubmitNewRole) return;
    const body: {
      user_group_id: number;
      game_operation_id?: number;
      club_id?: number;
    } = { user_group_id: this.newRoleId! };
    if (this.newRoleNeedsGo) body.game_operation_id = this.newRoleGoId!;
    if (this.newRoleNeedsClub) body.club_id = this.newRoleClubId!;

    this.managingRole = true;
    this._userService
      .addRole(this.user.id, body)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this.newRoleId = null;
          this.newRoleGoId = null;
          this.newRoleClubId = null;
          this.managingRole = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.roleAdded')
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.managingRole = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            err?.error?.error ||
              this._transloco.translate('userAdmin.notifications.saveError'),
            { autoClose: false }
          );
        },
      });
  }

  removeRole(role: UserAdminRole): void {
    if (!this.user || this.managingRole) return;
    if (
      !confirm(
        this._transloco.translate('userAdmin.notifications.confirmRemoveRole', {
          role: role.role_name,
        })
      )
    )
      return;

    const body: {
      user_group_id: number;
      game_operation_id?: number;
      club_id?: number;
    } = { user_group_id: role.user_group_id };
    if (role.game_operation_id) body.game_operation_id = role.game_operation_id;
    if (role.club_id) body.club_id = role.club_id;

    this.managingRole = true;
    this._userService
      .removeRole(this.user.id, body)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this.managingRole = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.roleRemoved')
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.managingRole = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            err?.error?.error ||
              this._transloco.translate('userAdmin.notifications.saveError'),
            { autoClose: false }
          );
        },
      });
  }

  submit(): void {
    if (!this.user) return;
    this.saving = true;

    const payload: Partial<UserAdminEntry> = { email: this.email };
    // Die aktuell gewählte Vereinszuweisung mit dem Haupt-"Speichern"
    // persistieren, damit sie nicht verloren geht, wenn der separate
    // "Verein speichern"-Button nicht gedrückt wurde.
    if (this.showClubAssignment && this.selectedClubId != null) {
      payload.club_id = this.selectedClubId;
    }
    // Gleiches gilt für die Team-Auswahl: Sie hing bisher ausschließlich am
    // separaten "Teams speichern"-Button. Haken setzen und dann das Haupt-
    // "Speichern" drücken verwarf die Auswahl stillschweigend.
    //
    // Nur bei echter Änderung mitsenden: Ein Konto, dessen Zuweisung noch an
    // einer Mannschaft vergangener Saisons hängt, ließe sich sonst nicht mehr
    // speichern, weil der Server nicht zuweisbare Teams jetzt ablehnt.
    if (this.showTeamAssignment && this._teamSelectionChanged()) {
      payload.teams = this.editableTeamIds;
    }

    this._userService
      .updateUser(this.user.id, payload)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this.saving = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.saved'),
            {
              autoClose: true,
              keepAfterRouteChange: true,
            }
          );
          this._router.navigate(['/', 'verwaltung', 'benutzer']);
        },
        // Kein eigener Toast: Der ErrorInterceptor zeigt für 4xx/5xx bereits die
        // Meldung des Servers. Der frühere Pauschaltext „Fehler beim Speichern"
        // kam zusätzlich und verdeckte die konkrete Ursache (#84).
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
        },
      });
  }

  saveTeams(): void {
    if (!this.user) return;
    this.savingTeams = true;

    this._userService
      .updateUser(this.user.id, { teams: this.editableTeamIds })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this.editableTeamIds = updated.teams ? [...updated.teams] : [];
          this.savingTeams = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.teamsSaved'),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.savingTeams = false;
          this._cdr.markForCheck();
        },
      });
  }

  saveGoAssignment(): void {
    if (!this.user || this.selectedGoId == null) return;
    this.savingAssignment = true;

    this._userService
      .updateUser(this.user.id, { game_operation_id: this.selectedGoId })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this.savingAssignment = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.goSaved'),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.savingAssignment = false;
          this._cdr.markForCheck();
        },
      });
  }

  saveClubAssignment(): void {
    if (!this.user || this.selectedClubId == null) return;
    this.savingAssignment = true;

    this._userService
      .updateUser(this.user.id, { club_id: this.selectedClubId })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          // Die Antwort ist maßgeblich: Der Server leert die Team-Zuweisung nur
          // beim echten Vereinswechsel. Vorher setzte die Maske sie hier immer
          // auf leer und zeigte damit einen Zustand, den es nicht gab.
          this.editableTeamIds = updated.teams ? [...updated.teams] : [];
          this.savingAssignment = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.clubSaved'),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.savingAssignment = false;
          this._cdr.markForCheck();
        },
      });
  }

  changeRole(newRole: number): void {
    if (!this.user || !this.canChangeRole) return;

    const label = newRole === 4 ? 'VM' : 'TM';
    if (
      !confirm(
        this._transloco.translate('userAdmin.notifications.confirmRoleChange', {
          role: label,
        })
      )
    )
      return;

    this._userService
      .updateUser(this.user.id, { role: newRole })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.roleChanged', {
              role: label,
            }),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate(
              'userAdmin.notifications.roleChangeError'
            ),
            {
              autoClose: false,
            }
          );
        },
      });
  }

  archiveUser(): void {
    if (!this.user || !this.canArchive || this.archiving) return;
    this.archiving = true;
    this._userService
      .archiveUser(this.user.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this.archiving = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.archived', {
              username: updated.username,
            }),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.archiving = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            err?.error?.error ||
              this._transloco.translate('userAdmin.notifications.saveError'),
            { autoClose: false }
          );
        },
      });
  }

  unarchiveUser(): void {
    if (!this.user || !this.canArchive || this.archiving) return;
    this.archiving = true;
    this._userService
      .unarchiveUser(this.user.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this.archiving = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.unarchived', {
              username: updated.username,
            }),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.archiving = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            err?.error?.error ||
              this._transloco.translate('userAdmin.notifications.saveError'),
            { autoClose: false }
          );
        },
      });
  }

  deleteUser(): void {
    if (!this.user || !this.canDelete) return;
    this.deleting = true;
    this._userService
      .deleteUser(this.user.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.deleting = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.userDeleted', {
              username: this.user!.username,
            }),
            { autoClose: true, keepAfterRouteChange: true }
          );
          this._router.navigate(['/', 'verwaltung', 'benutzer']);
        },
        error: () => {
          this.deleting = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate('userAdmin.notifications.deleteError'),
            {
              autoClose: false,
            }
          );
        },
      });
  }

  triggerPasswordReset(): void {
    if (!this.user) return;
    if (
      !confirm(
        this._transloco.translate(
          'userAdmin.notifications.confirmPasswordReset',
          { recipient: this.user.email || this.user.username }
        )
      )
    )
      return;

    this.sendingReset = true;
    this._userService
      .triggerPasswordReset(this.user.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.sendingReset = false;
          this._notificationService.success(
            this._transloco.translate('userAdmin.notifications.resetMailSent'),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.sendingReset = false;
          this._cdr.markForCheck();
          // Die API unterscheidet den gescheiterten Versand (502 mit Klartext)
          // von sonstigen Fehlern. Ist eine Nachricht dabei, ist sie genauer
          // als der allgemeine Text.
          this._notificationService.error(
            err?.error?.message ||
              this._transloco.translate(
                'userAdmin.notifications.resetMailError'
              ),
            {
              autoClose: false,
            }
          );
        },
      });
  }
}
