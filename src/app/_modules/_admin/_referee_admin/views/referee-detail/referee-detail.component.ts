import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  NotificationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import { RefereeAdmin, RefereeAdminGame } from '@floorball/types';

@Component({
  templateUrl: './referee-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeDetailComponent implements OnInit, OnDestroy {
  referee?: RefereeAdmin;
  games: RefereeAdminGame[] = [];
  loading = false;
  gamesLoading = false;
  walletLoading = false;
  userAccountLoading = false;
  canCreateUserAccount = false;
  selectedSeasonId?: number;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _route: ActivatedRoute,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.canCreateUserAccount = !!user?.permissions['referee_can_create'];
        this._cdr.markForCheck();
      });

    const param = this._route.snapshot.params['lizenznummer'] as string;
    this.loading = true;

    if (param.startsWith('G-')) {
      // Guest referee: look up directly by DB id
      const id = parseInt(param.slice(2), 10);
      this._refereeService
        .adminGetById(id)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (r) => {
            this.referee = r;
            this.loading = false;
            this._cdr.markForCheck();
            this.loadGames(r.id);
          },
          error: () => this._handleLoadError(),
        });
    } else {
      const lizenznummer = parseInt(param, 10);
      this._refereeService
        .adminGetAll({ q: String(lizenznummer) })
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (results) => {
            const match = results.find((r) => r.lizenznummer === lizenznummer);
            if (match) {
              this._refereeService
                .adminGetById(match.id)
                .pipe(takeUntil(this._destroy$))
                .subscribe({
                  next: (r) => {
                    this.referee = r;
                    this.loading = false;
                    this._cdr.markForCheck();
                    this.loadGames(r.id);
                  },
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

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  loadGames(id: number): void {
    this.gamesLoading = true;
    this._refereeService
      .adminGetGames(id, this.selectedSeasonId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.games = result;
          this.gamesLoading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.gamesLoading = false;
          this._cdr.markForCheck();
        },
      });
  }

  createWalletPass(): void {
    if (!this.referee) return;
    this.walletLoading = true;
    this._refereeService
      .adminCreateWalletPass(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.walletLoading = false;
          if (this.referee) {
            this.referee = {
              ...this.referee,
              wallet_pass_issued_at: new Date().toISOString(),
              wallet_pass_url: result.url,
            };
          }
          this._cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.walletLoading = false;
          const apiMessage =
            typeof err?.error?.error === 'string' ? err.error.error : undefined;
          this._notificationService.error(
            apiMessage || 'Wallet-Pass konnte nicht erstellt werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  createUserAccount(): void {
    if (!this.referee) return;
    this.userAccountLoading = true;
    this._refereeService
      .adminCreateUserAccount(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.referee = updated;
          this.userAccountLoading = false;
          this._cdr.markForCheck();
          this._notificationService.success('Benutzerkonto wurde angelegt.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
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

  get detailRouteId(): string | number {
    return this.referee?.guest
      ? this.referee.lizenznummer_display ?? this.referee.id
      : this.referee?.lizenznummer ?? '';
  }

  get isActive(): boolean {
    if (!this.referee?.gueltigkeit) return false;
    const parts = this.referee.gueltigkeit.split('.');
    if (parts.length !== 3) return false;
    // End of the expiry day so license is valid the entire last day
    const date = new Date(+parts[2], +parts[1] - 1, +parts[0], 23, 59, 59);
    return date >= new Date();
  }

  private _handleLoadError(): void {
    this.loading = false;
    this._cdr.markForCheck();
    this._notificationService.error('Fehler beim Laden des Schiedsrichters.', {
      autoClose: false,
      keepAfterRouteChange: false,
    });
  }
}
