import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import {
  ClubService,
  NotificationService,
  TransferRequestService,
} from '@floorball/core';
import { PlayerSearchResult } from '@floorball/types';

@Component({
  templateUrl: './transfer-request-direct.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TransferRequestDirectComponent implements OnInit, OnDestroy {
  firstName = '';
  lastName = '';
  birthdate = '';

  clubs: { id: number; name: string }[] = [];
  selectedClubId = 0;

  foundPlayer: PlayerSearchResult | null = null;
  searchError = '';
  searching = false;
  submitting = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _clubService: ClubService,
    private _notificationService: NotificationService,
    private _router: Router,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._clubService
      .getAdminClubs()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (gos) => {
          this.clubs = gos
            .flatMap((go) => go.clubs)
            .map((c) => ({ id: c.id, name: c.name }))
            .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
            .sort((a, b) => a.name.localeCompare(b.name));
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate(
              'transferRequestAdmin.notifications.clubLoadError'
            )
          );
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  search(): void {
    if (
      !this.firstName ||
      !this.lastName ||
      !this.birthdate ||
      !this.selectedClubId
    )
      return;

    this.searching = true;
    this.foundPlayer = null;
    this.searchError = '';

    this._transferService
      .searchPlayer(
        this.firstName,
        this.lastName,
        this.birthdate,
        this.selectedClubId
      )
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.foundPlayer = result.player;
          if (!result.player) {
            this.searchError = this._transloco.translate(
              'transferRequestAdmin.notifications.playerNotFound'
            );
          }
          this.searching = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.searchError =
            err?.error?.error ||
            this._transloco.translate(
              'transferRequestAdmin.notifications.searchError'
            );
          this.searching = false;
          this._cdr.markForCheck();
        },
      });
  }

  submit(): void {
    if (!this.foundPlayer || !this.selectedClubId) return;

    this.submitting = true;
    this._transferService
      .directAssign(this.foundPlayer.id, this.selectedClubId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this._notificationService.success(
            this._transloco.translate(
              'transferRequestAdmin.notifications.directAssignSuccess'
            )
          );
          this._router.navigate(['/verwaltung/transfer-anfragen']);
        },
        error: (err) => {
          this._notificationService.error(
            err?.error?.error ||
              this._transloco.translate(
                'transferRequestAdmin.notifications.directAssignError'
              )
          );
          this.submitting = false;
          this._cdr.markForCheck();
        },
      });
  }

  cancel(): void {
    this._router.navigate(['/verwaltung/transfer-anfragen']);
  }
}
