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
import {
  UserManagementService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import { UserAdminEntry, User } from '@floorball/types';

@Component({
  templateUrl: './user-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class UserIndexComponent implements OnInit, OnDestroy {
  users: UserAdminEntry[] = [];
  loading = false;
  currentUser: User | null = null;
  selectedRole: number | null = null;
  showArchived = false;

  readonly roleOptions = [
    { label: this._transloco.translate('userAdmin.index.roleAdmin'), value: 1 },
    { label: this._transloco.translate('userAdmin.index.roleSbk'), value: 2 },
    { label: this._transloco.translate('userAdmin.index.roleRsk'), value: 3 },
    {
      label: this._transloco.translate('userAdmin.index.roleAnsetzer'),
      value: 7,
    },
    { label: this._transloco.translate('userAdmin.index.roleVm'), value: 4 },
    { label: this._transloco.translate('userAdmin.index.roleTm'), value: 5 },
    {
      label: this._transloco.translate('userAdmin.index.roleReferee'),
      value: 6,
    },
  ];

  private _destroy$ = new Subject<void>();

  constructor(
    private _userService: UserManagementService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this._cdr.markForCheck();
      });
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._userService
      .getUsers()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  get isAdminOrSbk(): boolean {
    return !!this.currentUser?.permissions['menu_item_user_admin'];
  }

  get canCreate(): boolean {
    return !!this.currentUser?.permissions['menu_item_user_create'];
  }

  get filteredUsers(): UserAdminEntry[] {
    const byRole =
      this.selectedRole === null
        ? this.users
        : this.users.filter((u) =>
            u.roles.some((r) => r.user_group_id === this.selectedRole)
          );
    return this.showArchived ? byRole : byRole.filter((u) => !u.archived_at);
  }

  // Anzahl archivierter Konten im aktuellen Rollen-Filter (für den
  // Anzeigen/Ausblenden-Link, analog zur VM-Spielerliste).
  get archivedCount(): number {
    const byRole =
      this.selectedRole === null
        ? this.users
        : this.users.filter((u) =>
            u.roles.some((r) => r.user_group_id === this.selectedRole)
          );
    return byRole.filter((u) => u.archived_at).length;
  }

  roleLabel(user: UserAdminEntry): string {
    if (!user.roles.length) return '–';
    return user.roles.map((r) => r.role_name).join(', ');
  }

  // Zuordnung je nach Rolle: VM→Verein, TM→Team(s), SBK/RSK/Ansetzer→Sportverbund.
  assignmentLabel(user: UserAdminEntry): string {
    const parts: string[] = [];
    for (const r of user.roles) {
      if (r.user_group_id === 5) {
        if (user.team_names?.length) parts.push(...user.team_names);
      } else if (r.user_group_id === 4) {
        if (r.club_name) parts.push(r.club_name);
      } else if ([2, 3, 7].includes(r.user_group_id)) {
        if (r.game_operation_name) parts.push(r.game_operation_name);
      }
    }
    const unique = Array.from(new Set(parts));
    return unique.length ? unique.join(' · ') : '–';
  }
}
