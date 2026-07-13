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
  active = true;
  saving = false;
  sendingReset = false;
  deleting = false;

  clubsWithTeams: ClubWithTeams[] = [];
  editableTeamIds: number[] = [];
  savingTeams = false;

  gameOperations: GameOperation[] = [];
  selectedGoId: number | null = null;
  selectedClubId: number | null = null;
  savingAssignment = false;

  // Mehrfachrollen-Verwaltung (nur Admin). Admin-Rolle (1) wird hier bewusst nicht angeboten.
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
          this.active = user.active;
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

  get isAdminOrSbk(): boolean {
    return !!this.currentUser?.permissions['menu_item_user_admin'];
  }

  get canDelete(): boolean {
    return (
      !!this.currentUser?.permissions['user_delete'] &&
      this.user?.id !== this.currentUser?.id
    );
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
      (this.isAdminOrSbk || this.isVm)
    );
  }

  get showGoAssignment(): boolean {
    const roleId = this.userPrimaryRoleId;
    return this.isAdminOrSbk && roleId !== null && [2, 3, 7].includes(roleId);
  }

  get showClubAssignment(): boolean {
    const roleId = this.userPrimaryRoleId;
    return (
      (this.isAdminOrSbk || this.isVm) &&
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
    if (this.isAdminOrSbk) {
      payload.active = this.active;
    }
    // Die aktuell gewählte Vereinszuweisung mit dem Haupt-"Speichern"
    // persistieren, damit sie nicht verloren geht, wenn der separate
    // "Verein speichern"-Button nicht gedrückt wurde.
    if (this.showClubAssignment && this.selectedClubId != null) {
      payload.club_id = this.selectedClubId;
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
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate('userAdmin.notifications.saveError'),
            {
              autoClose: false,
            }
          );
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
          this._notificationService.error(
            this._transloco.translate('userAdmin.notifications.saveError'),
            {
              autoClose: false,
            }
          );
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
          this._notificationService.error(
            this._transloco.translate('userAdmin.notifications.saveError'),
            {
              autoClose: false,
            }
          );
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
          this.editableTeamIds = [];
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
          this._notificationService.error(
            this._transloco.translate('userAdmin.notifications.saveError'),
            {
              autoClose: false,
            }
          );
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
        error: () => {
          this.sendingReset = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate('userAdmin.notifications.resetMailError'),
            {
              autoClose: false,
            }
          );
        },
      });
  }
}
