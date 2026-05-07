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
  NotificationService,
  SessionService,
  TransferRequestService,
} from '@floorball/core';
import { PlayerSearchResult } from '@floorball/types';

@Component({
  templateUrl: './transfer-request-initiate.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferRequestInitiateComponent implements OnInit, OnDestroy {
  firstName = '';
  lastName = '';
  birthdate = '';

  foundPlayer: PlayerSearchResult | null = null;
  searchError = '';
  searching = false;
  submitting = false;

  currentUserClubIds: number[] = [];
  selectedClubId = 0;
  managedClubs: { id: number; name: string }[] = [];

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _sessionService: SessionService,
    private _clubService: ClubService,
    private _notificationService: NotificationService,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.currentUserClubIds = user?.club_ids || [];
          if (this.currentUserClubIds.length === 1) {
            this.selectedClubId = this.currentUserClubIds[0];
          } else if (this.currentUserClubIds.length > 1) {
            this._clubService
              .adminGetClubAndTeams()
              .pipe(takeUntil(this._destroy$))
              .subscribe({
                next: (clubs) => {
                  this.managedClubs = clubs
                    .filter((c) => this.currentUserClubIds.includes(c.id))
                    .map((c) => ({ id: c.id, name: c.name }));
                  this._cdr.markForCheck();
                },
              });
          }
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  search(): void {
    if (!this.firstName || !this.lastName || !this.birthdate) return;

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
            this.searchError = 'Kein Spieler mit diesen Daten gefunden.';
          }
          this.searching = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.searchError = err?.error?.error || 'Fehler bei der Suche.';
          this.searching = false;
          this._cdr.markForCheck();
        },
      });
  }

  submit(): void {
    if (!this.foundPlayer || !this.selectedClubId) return;

    this.submitting = true;
    this._transferService
      .create(this.foundPlayer.id, this.selectedClubId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Transferantrag erfolgreich gestellt.'
          );
          this._router.navigate(['/verwaltung/transfer-anfragen']);
        },
        error: (err) => {
          this._notificationService.error(
            err?.error?.error || 'Fehler beim Erstellen des Antrags.'
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
