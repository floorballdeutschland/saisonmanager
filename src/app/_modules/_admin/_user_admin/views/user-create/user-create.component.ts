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
import { Club, GameOperation, User } from '@floorball/types';

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

  clubs: Club[] = [];
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

  get availableRoles(): RoleOption[] {
    if (this.isAdmin) return this.allRoles;
    return this.allRoles.filter((r) => r.id === 4 || r.id === 5);
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

  submit(): void {
    if (!this.isValid || this.saving) return;

    this.saving = true;
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
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          const isTm = this.selectedRoleId === 5;
          const msg = isTm
            ? `Benutzer ${created.name} angelegt. Eine E-Mail zum Passwort setzen wurde versandt. Hinweis: TM-Nutzer benötigen noch eine Team-Zuweisung, sonst ist der Login gesperrt.`
            : `Benutzer ${created.name} angelegt. Eine E-Mail zum Passwort setzen wurde versandt.`;
          this._notificationService.success(msg, {
            autoClose: !isTm,
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
