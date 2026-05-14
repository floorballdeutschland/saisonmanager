import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  ClubService,
  AssociationService,
  UserManagementService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import {
  Club,
  ClubWithTeams,
  GameOperation,
  Team,
  User,
} from '@floorball/types';

interface RoleOption {
  id: number;
  label: string;
  needsClub: boolean;
  needsGo: boolean;
}

@Component({
  templateUrl: './user-create.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCreateComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  saving = false;

  userName = '';
  firstName = '';
  lastName = '';
  email = '';
  selectedRoleId: number = 4;
  selectedClubId: number | null = null;
  selectedGoId: number | null = null;
  selectedTeamIds: number[] = [];

  clubs: Club[] = [];
  clubsWithTeams: ClubWithTeams[] = [];
  gameOperations: GameOperation[] = [];

  readonly allRoles: RoleOption[] = [
    { id: 1, label: 'Admin', needsClub: false, needsGo: true },
    { id: 2, label: 'SBK', needsClub: false, needsGo: true },
    { id: 4, label: 'VM (Vereinsmanager)', needsClub: true, needsGo: false },
    { id: 5, label: 'TM (Teammanager)', needsClub: true, needsGo: false },
  ];

  private _destroy$ = new Subject<void>();

  constructor(
    private _userService: UserManagementService,
    private _clubService: ClubService,
    private _associationService: AssociationService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        if (this.isVm) {
          this.selectedRoleId = 5;
        }
        this._cdr.markForCheck();
      });

    this._clubService
      .getAdminClubAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (clubs) => {
          this.clubs = clubs;
          this._cdr.markForCheck();
        },
      });

    this._clubService
      .adminGetClubAndTeams()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.clubsWithTeams = data;
          if (this.isVm && data.length === 1) {
            this.selectedClubId = data[0].id;
          }
          this._cdr.markForCheck();
        },
      });

    this._associationService.associations$
      .pipe(takeUntil(this._destroy$))
      .subscribe((gos) => {
        this.gameOperations = gos;
        this._cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get isAdmin(): boolean {
    return !!this.currentUser?.permissions['menu_item_state_association_admin'];
  }

  get isVm(): boolean {
    return (
      !!this.currentUser?.permissions['menu_item_user_vm'] && !this.isAdmin
    );
  }

  get availableRoles(): RoleOption[] {
    if (this.isAdmin) return this.allRoles;
    if (this.isVm) return this.allRoles.filter((r) => r.id === 5);
    return this.allRoles.filter((r) => r.id === 4 || r.id === 5);
  }

  get vmClubs(): Club[] {
    return this.clubsWithTeams;
  }

  get availableTeams(): Team[] {
    if (!this.selectedClubId) return [];
    const club = this.clubsWithTeams.find((c) => c.id === this.selectedClubId);
    return club?.teams ?? [];
  }

  get selectedRole(): RoleOption | undefined {
    return this.allRoles.find((r) => r.id === this.selectedRoleId);
  }

  get isValid(): boolean {
    if (
      !this.userName.trim() ||
      !this.firstName.trim() ||
      !this.lastName.trim() ||
      !this.email.trim()
    )
      return false;
    if (this.selectedRole?.needsClub && !this.selectedClubId) return false;
    if (this.selectedRole?.needsGo && !this.selectedGoId) return false;
    return true;
  }

  onClubChange(): void {
    this.selectedTeamIds = [];
  }

  toggleTeam(teamId: number): void {
    const idx = this.selectedTeamIds.indexOf(teamId);
    if (idx >= 0) {
      this.selectedTeamIds = this.selectedTeamIds.filter((t) => t !== teamId);
    } else {
      this.selectedTeamIds = [...this.selectedTeamIds, teamId];
    }
  }

  isTeamSelected(teamId: number): boolean {
    return this.selectedTeamIds.includes(teamId);
  }

  submit(): void {
    if (!this.isValid || this.saving) return;

    this.saving = true;
    const teams =
      this.selectedRoleId === 5 && this.selectedTeamIds.length > 0
        ? this.selectedTeamIds
        : undefined;

    this._userService
      .createUser({
        user: {
          user_name: this.userName.trim(),
          first_name: this.firstName.trim(),
          last_name: this.lastName.trim(),
          email: this.email.trim(),
        },
        role: {
          user_group_id: this.selectedRoleId,
          club_id: this.selectedRole?.needsClub ? this.selectedClubId : null,
          game_operation_id: this.selectedRole?.needsGo
            ? this.selectedGoId
            : null,
        },
        teams,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          const isTm = this.selectedRoleId === 5;
          const msg = isTm
            ? `Benutzer ${created.name} angelegt. Eine E-Mail zum Passwort setzen wurde versandt.`
            : `Benutzer ${created.name} angelegt. Eine E-Mail zum Passwort setzen wurde versandt.`;
          this._notificationService.success(msg, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          this._router.navigate([
            '/',
            'verwaltung',
            'benutzer',
            created.id,
            'bearbeiten',
          ]);
        },
        error: (err) => {
          this.saving = false;
          const msg =
            err?.error?.errors?.join(', ') ??
            err?.error?.error ??
            'Fehler beim Anlegen';
          this._notificationService.error(msg, { autoClose: false });
          this._cdr.markForCheck();
        },
      });
  }
}
