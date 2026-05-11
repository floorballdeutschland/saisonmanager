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
})
export class UserIndexComponent implements OnInit, OnDestroy {
  users: UserAdminEntry[] = [];
  loading = false;
  currentUser: User | null = null;

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

  roleLabel(user: UserAdminEntry): string {
    if (!user.roles.length) return '–';
    return user.roles.map((r) => r.role_name).join(', ');
  }
}
