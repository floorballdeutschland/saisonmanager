import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
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
  selectedSeasonId?: number;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _route: ActivatedRoute,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const lizenznummer = parseInt(
      this._route.snapshot.params['lizenznummer'],
      10
    );
    this.loading = true;

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
                error: () => {
                  this.loading = false;
                  this._cdr.markForCheck();
                  this._notificationService.error(
                    'Fehler beim Laden des Schiedsrichters.',
                    { autoClose: false, keepAfterRouteChange: false }
                  );
                },
              });
          } else {
            this.loading = false;
            this._cdr.markForCheck();
          }
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error('Fehler beim Laden.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
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
          if (result.url) window.open(result.url, '_blank');
          this._cdr.markForCheck();
        },
        error: () => {
          this.walletLoading = false;
          this._notificationService.error(
            'Wallet-Pass konnte nicht erstellt werden.',
            {
              autoClose: false,
              keepAfterRouteChange: false,
            }
          );
          this._cdr.markForCheck();
        },
      });
  }

  get isActive(): boolean {
    if (!this.referee?.gueltigkeit) return false;
    const parts = this.referee.gueltigkeit.split('.');
    if (parts.length !== 3) return false;
    // End of the expiry day so license is valid the entire last day
    const date = new Date(+parts[2], +parts[1] - 1, +parts[0], 23, 59, 59);
    return date >= new Date();
  }
}
