import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
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
  searchQuery = '';
  sortColumn: 'name' | 'assignment' = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Nur Keys ablegen und im Template per Pipe übersetzen – translate() im
  // Feld-Initialisierer läuft, bevor der userAdmin-Scope geladen ist, und
  // liefert dann die rohen Keys.
  readonly roleOptions = [
    { labelKey: 'userAdmin.index.roleAdmin', value: 1 },
    { labelKey: 'userAdmin.index.roleSbk', value: 2 },
    { labelKey: 'userAdmin.index.roleRsk', value: 3 },
    { labelKey: 'userAdmin.index.roleAnsetzer', value: 7 },
    { labelKey: 'userAdmin.index.roleVm', value: 4 },
    { labelKey: 'userAdmin.index.roleTm', value: 5 },
    { labelKey: 'userAdmin.index.roleReferee', value: 6 },
  ];

  private _destroy$ = new Subject<void>();

  constructor(
    private _userService: UserManagementService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
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
    const matched = this.matchedUsers;
    const visible = this.showArchived
      ? matched
      : matched.filter((u) => !u.archived_at);
    return [...visible].sort((a, b) => this.compareUsers(a, b));
  }

  // Anzahl archivierter Konten im aktuellen Rollen-/Such-Filter (für den
  // Anzeigen/Ausblenden-Link, analog zur VM-Spielerliste).
  get archivedCount(): number {
    return this.matchedUsers.filter((u) => u.archived_at).length;
  }

  toggleSort(column: 'name' | 'assignment'): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  // Rollen-Filter und Freitextsuche kombiniert (UND-verknüpft).
  private get matchedUsers(): UserAdminEntry[] {
    let result = this.users;
    if (this.selectedRole !== null) {
      result = result.filter((u) =>
        u.roles.some((r) => r.user_group_id === this.selectedRole)
      );
    }
    const query = this.searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((u) =>
        [u.name, u.username, u.email, this.assignmentLabel(u)].some(
          (field) => !!field && field.toLowerCase().includes(query)
        )
      );
    }
    return result;
  }

  private compareUsers(a: UserAdminEntry, b: UserAdminEntry): number {
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    if (this.sortColumn === 'assignment') {
      return (
        this.compareBlanksLast(
          this.assignmentLabel(a),
          this.assignmentLabel(b),
          direction
        ) || this.compareBlanksLast(a.name, b.name, 1)
      );
    }
    return this.compareBlanksLast(a.name, b.name, direction);
  }

  // Leere Werte ("–", null) stehen unabhängig von der Sortierrichtung hinten,
  // sonst beginnt die Liste mit einem Block Striche.
  private compareBlanksLast(
    a: string | null | undefined,
    b: string | null | undefined,
    direction: number
  ): number {
    const av = a && a !== '–' ? a : '';
    const bv = b && b !== '–' ? b : '';
    if (!av || !bv) {
      if (av === bv) return 0;
      return av ? -1 : 1;
    }
    return av.localeCompare(bv, 'de', { sensitivity: 'base' }) * direction;
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
