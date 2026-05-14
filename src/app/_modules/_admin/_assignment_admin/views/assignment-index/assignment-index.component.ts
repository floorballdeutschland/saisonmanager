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
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeAssignableGame, RefereeAssignment } from '@floorball/types';

@Component({
  templateUrl: './assignment-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentIndexComponent implements OnInit, OnDestroy {
  assignments: RefereeAssignment[] = [];
  games: RefereeAssignableGame[] = [];
  loading = false;
  loadingGames = false;
  notifyingId: number | null = null;
  activeTab: 'assignments' | 'games' = 'games';

  filterSeasonId = '';
  filterDateFrom = '';
  filterDateTo = '';

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._load();
    this._loadGames();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  applyFilter(): void {
    this._load();
    this._loadGames();
  }

  editAssignment(gameId: number, game?: RefereeAssignableGame): void {
    this._router.navigate(
      ['/', 'verwaltung', 'schiedsrichter-ansetzungen', gameId],
      { state: { game } }
    );
  }

  notify(assignment: RefereeAssignment): void {
    this.notifyingId = assignment.id;
    this._refereeService
      .adminNotifyAssignment(assignment.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.assignments = this.assignments.map((a) =>
            a.id === updated.id ? updated : a
          );
          this.notifyingId = null;
          this._cdr.markForCheck();
          this._notificationService.success('Benachrichtigung gesendet.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: () => {
          this.notifyingId = null;
          this._cdr.markForCheck();
          this._notificationService.error('Fehler beim Senden.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  statusLabel(status: string): string {
    return status === 'published' ? 'Veröffentlicht' : 'Vorläufig';
  }

  statusClass(status: string): string {
    return status === 'published'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
  }

  assignmentStatusLabel(status?: string | null): string {
    if (!status) return 'Offen';
    return status === 'published' ? 'Veröffentlicht' : 'Vorläufig';
  }

  assignmentStatusClass(status?: string | null): string {
    if (!status) return 'bg-gray-100 text-gray-500';
    return status === 'published'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
  }

  private _load(): void {
    this.loading = true;
    this._refereeService
      .adminGetAssignments({
        season_id: this.filterSeasonId || undefined,
        date_from: this.filterDateFrom || undefined,
        date_to: this.filterDateTo || undefined,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (list) => {
          this.assignments = list;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            'Ansetzungen konnten nicht geladen werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }

  private _loadGames(): void {
    this.loadingGames = true;
    this._refereeService
      .adminGetAssignableGames({
        season_id: this.filterSeasonId || undefined,
        date_from: this.filterDateFrom || undefined,
        date_to: this.filterDateTo || undefined,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (list) => {
          this.games = list;
          this.loadingGames = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loadingGames = false;
          this._cdr.markForCheck();
        },
      });
  }
}
