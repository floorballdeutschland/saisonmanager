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
import {
  UserManagementService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import { UserAdminEntry, User } from '@floorball/types';

@Component({
  templateUrl: './user-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserEditComponent implements OnInit, OnDestroy {
  user: UserAdminEntry | null = null;
  currentUser: User | null = null;
  email = '';
  active = true;
  saving = false;
  sendingReset = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _userService: UserManagementService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
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
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error('Benutzer nicht gefunden.', {
            autoClose: false,
          });
          this._router.navigate(['/', 'verwaltung', 'benutzer']);
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

  get isVm(): boolean {
    return !!this.currentUser?.permissions['menu_item_user_vm'];
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

  get canChangeRole(): boolean {
    return (
      !this.isSelf &&
      this.currentRoleId !== null &&
      (this.isAdminOrSbk || this.isVm)
    );
  }

  submit(): void {
    if (!this.user) return;
    this.saving = true;

    const payload: Partial<UserAdminEntry> = { email: this.email };
    if (this.isAdminOrSbk) {
      payload.active = this.active;
    }

    this._userService
      .updateUser(this.user.id, payload)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this.saving = false;
          this._notificationService.success('Gespeichert.', {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          this._router.navigate(['/', 'verwaltung', 'benutzer']);
        },
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.error('Fehler beim Speichern.', {
            autoClose: false,
          });
        },
      });
  }

  changeRole(newRole: number): void {
    if (!this.user || !this.canChangeRole) return;

    const label = newRole === 4 ? 'VM' : 'TM';
    if (!confirm(`Rolle auf ${label} ändern?`)) return;

    this._userService
      .updateUser(this.user.id, { role: newRole })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.user = updated;
          this._notificationService.success(`Rolle auf ${label} geändert.`, {
            autoClose: true,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error('Fehler beim Ändern der Rolle.', {
            autoClose: false,
          });
        },
      });
  }

  triggerPasswordReset(): void {
    if (!this.user) return;
    if (
      !confirm(
        `Passwort-Reset-Mail an "${
          this.user.email || this.user.username
        }" senden?`
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
          this._notificationService.success('E-Mail wurde gesendet.', {
            autoClose: true,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this.sendingReset = false;
          this._cdr.markForCheck();
          this._notificationService.error('Fehler beim Senden.', {
            autoClose: false,
          });
        },
      });
  }
}
