import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import {
  NotificationService,
  RefereeService,
  SeasonInfo,
  SettingsService,
} from '@floorball/core';
import {
  RefereeAssignableGame,
  RefereeAssignment,
  RefereeAssignmentAvailable,
} from '@floorball/types';

interface RowState {
  referee1Query: string;
  referee2Query: string;
  selectedReferee1Id: number | null;
  selectedReferee2Id: number | null;
  showReferee1Dropdown: boolean;
  showReferee2Dropdown: boolean;
  availableReferees: RefereeAssignmentAvailable[];
  loadingReferees: boolean;
  saving: boolean;
  notifying: boolean;
  publishing: boolean;
}

interface MergedGame {
  game: RefereeAssignableGame;
  assignment: RefereeAssignment | null;
}

@Component({
  templateUrl: './assignment-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AssignmentIndexComponent implements OnInit, OnDestroy {
  rows: MergedGame[] = [];
  seasons: SeasonInfo[] = [];
  loading = false;
  seasonsLoading = true;

  filterSeasonId = '';
  filterDateFrom = new Date().toLocaleDateString('sv-SE');
  filterDateTo = '';

  rowStates = new Map<number, RowState>();

  private _assignments: RefereeAssignment[] = [];
  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _settingsService: SettingsService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._settingsService
      .getSeasons()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.seasons = data.seasons;
          this.filterSeasonId = data.current_season_id.toString();
          this.seasonsLoading = false;
          this._cdr.markForCheck();
          this._load();
        },
        error: () => {
          this.seasonsLoading = false;
          this._cdr.markForCheck();
          this._load();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  applyFilter(): void {
    this._load();
  }

  getState(gameId: number): RowState | undefined {
    return this.rowStates.get(gameId);
  }

  arenaLocation(game: RefereeAssignableGame): string {
    const parts = [game.arena_postcode, game.arena_city].filter(Boolean);
    return parts.join(' ');
  }

  filteredReferees(
    gameId: number,
    query: string
  ): RefereeAssignmentAvailable[] {
    const state = this.rowStates.get(gameId);
    if (!state) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.availableReferees.filter(
      (r) =>
        r.vorname.toLowerCase().includes(q) ||
        r.nachname.toLowerCase().includes(q)
    );
  }

  onRefereeFocus(gameId: number): void {
    const state = this.rowStates.get(gameId);
    if (!state || state.loadingReferees || state.availableReferees.length > 0)
      return;
    const row = this.rows.find((r) => r.game.id === gameId);
    if (!row) return;
    state.loadingReferees = true;
    this._cdr.markForCheck();
    this._refereeService
      .adminGetAvailableReferees(row.game.date, gameId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (list) => {
          state.availableReferees = list;
          state.loadingReferees = false;
          this._cdr.markForCheck();
        },
        error: () => {
          state.loadingReferees = false;
          this._cdr.markForCheck();
        },
      });
  }

  onReferee1Input(gameId: number, value: string): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.referee1Query = value;
    state.selectedReferee1Id = null;
    state.showReferee1Dropdown = value.trim().length > 0;
    this._cdr.markForCheck();
  }

  onReferee2Input(gameId: number, value: string): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.referee2Query = value;
    state.selectedReferee2Id = null;
    state.showReferee2Dropdown = value.trim().length > 0;
    this._cdr.markForCheck();
  }

  selectReferee1(gameId: number, r: RefereeAssignmentAvailable): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.selectedReferee1Id = r.id;
    state.referee1Query = this._refereeName(r);
    state.showReferee1Dropdown = false;
    this._cdr.markForCheck();
    if (r.partner_lizenznummer && !state.selectedReferee2Id) {
      const partner = state.availableReferees.find(
        (x) => x.lizenznummer === r.partner_lizenznummer
      );
      if (partner) {
        state.selectedReferee2Id = partner.id;
        state.referee2Query = this._refereeName(partner);
        this._cdr.markForCheck();
      }
    }
  }

  selectReferee2(gameId: number, r: RefereeAssignmentAvailable): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.selectedReferee2Id = r.id;
    state.referee2Query = this._refereeName(r);
    state.showReferee2Dropdown = false;
    this._cdr.markForCheck();
  }

  clearReferee1(gameId: number): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.selectedReferee1Id = null;
    state.referee1Query = '';
    state.showReferee1Dropdown = false;
    this._cdr.markForCheck();
  }

  clearReferee2(gameId: number): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.selectedReferee2Id = null;
    state.referee2Query = '';
    state.showReferee2Dropdown = false;
    this._cdr.markForCheck();
  }

  onReferee1Blur(gameId: number): void {
    setTimeout(() => {
      const state = this.rowStates.get(gameId);
      if (!state) return;
      state.showReferee1Dropdown = false;
      if (!state.selectedReferee1Id) {
        state.referee1Query = '';
      } else {
        const r = state.availableReferees.find(
          (x) => x.id === state.selectedReferee1Id
        );
        if (r) state.referee1Query = this._refereeName(r);
      }
      this._cdr.markForCheck();
    }, 200);
  }

  onReferee2Blur(gameId: number): void {
    setTimeout(() => {
      const state = this.rowStates.get(gameId);
      if (!state) return;
      state.showReferee2Dropdown = false;
      if (!state.selectedReferee2Id) {
        state.referee2Query = '';
      } else {
        const r = state.availableReferees.find(
          (x) => x.id === state.selectedReferee2Id
        );
        if (r) state.referee2Query = this._refereeName(r);
      }
      this._cdr.markForCheck();
    }, 200);
  }

  save(row: MergedGame): void {
    const state = this.rowStates.get(row.game.id);
    if (!state || state.saving) return;
    state.saving = true;
    this._cdr.markForCheck();

    const data = {
      game_id: row.game.id,
      referee1_id: state.selectedReferee1Id,
      referee2_id: state.selectedReferee2Id,
    };

    const call = row.assignment
      ? this._refereeService.adminUpdateAssignment(row.assignment.id, data)
      : this._refereeService.adminCreateAssignment(data);

    call.pipe(takeUntil(this._destroy$)).subscribe({
      next: (saved) => {
        row.assignment = saved;
        row.game.assignment_id = saved.id;
        row.game.assignment_status = saved.status;
        state.saving = false;
        this._cdr.markForCheck();
        this._notificationService.success('Ansetzung gespeichert.', {
          autoClose: true,
          keepAfterRouteChange: false,
        });
      },
      error: (err) => {
        state.saving = false;
        this._cdr.markForCheck();
        const msg = err?.error?.errors?.[0] || 'Fehler beim Speichern.';
        this._notificationService.error(msg, {
          autoClose: false,
          keepAfterRouteChange: false,
        });
      },
    });
  }

  notify(row: MergedGame): void {
    if (!row.assignment) return;
    const state = this.rowStates.get(row.game.id);
    if (!state || state.notifying) return;
    state.notifying = true;
    this._cdr.markForCheck();

    this._refereeService
      .adminNotifyAssignment(row.assignment.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          row.assignment = updated;
          state.notifying = false;
          this._cdr.markForCheck();
          this._notificationService.success('Benachrichtigung gesendet.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: () => {
          state.notifying = false;
          this._cdr.markForCheck();
          this._notificationService.error('Fehler beim Senden.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  publish(row: MergedGame): void {
    if (!row.assignment) return;
    const state = this.rowStates.get(row.game.id);
    if (!state || state.publishing) return;
    state.publishing = true;
    this._cdr.markForCheck();

    this._refereeService
      .adminPublishAssignment(row.assignment.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (saved) => {
          row.assignment = saved;
          row.game.assignment_status = saved.status;
          state.publishing = false;
          this._cdr.markForCheck();
          this._notificationService.success('Ansetzung veröffentlicht.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: () => {
          state.publishing = false;
          this._cdr.markForCheck();
          this._notificationService.error('Fehler beim Veröffentlichen.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
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

  private _refereeName(r: {
    vorname: string;
    nachname: string;
    lizenzstufe?: string;
  }): string {
    return `${r.nachname}, ${r.vorname}${
      r.lizenzstufe ? ' (' + r.lizenzstufe + ')' : ''
    }`;
  }

  private _load(): void {
    this.loading = true;
    const filters = {
      season_id: this.filterSeasonId || undefined,
      date_from: this.filterDateFrom || undefined,
      date_to: this.filterDateTo || undefined,
    };

    forkJoin({
      games: this._refereeService.adminGetAssignableGames(filters),
      assignments: this._refereeService.adminGetAssignments(filters),
    })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: ({ games, assignments }) => {
          this._assignments = assignments;
          this._buildRows(games);
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            'Daten konnten nicht geladen werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }

  private _buildRows(games: RefereeAssignableGame[]): void {
    const assignmentMap = new Map<number, RefereeAssignment>();
    this._assignments.forEach((a) => {
      if (a.game_id) assignmentMap.set(a.game_id, a);
    });

    this.rows = games.map((g) => ({
      game: g,
      assignment: assignmentMap.get(g.id) ?? null,
    }));

    const existingIds = new Set(this.rowStates.keys());
    this.rows.forEach((r) => {
      if (!existingIds.has(r.game.id)) {
        this.rowStates.set(r.game.id, this._createRowState(r.assignment));
      }
    });
    existingIds.forEach((id) => {
      if (!this.rows.some((r) => r.game.id === id)) {
        this.rowStates.delete(id);
      }
    });
  }

  private _createRowState(assignment: RefereeAssignment | null): RowState {
    const ref1 = assignment?.referee1 ?? null;
    const ref2 = assignment?.referee2 ?? null;
    return {
      referee1Query: ref1 ? this._refereeName(ref1) : '',
      referee2Query: ref2 ? this._refereeName(ref2) : '',
      selectedReferee1Id: ref1?.id ?? null,
      selectedReferee2Id: ref2?.id ?? null,
      showReferee1Dropdown: false,
      showReferee2Dropdown: false,
      availableReferees: [],
      loadingReferees: false,
      saving: false,
      notifying: false,
      publishing: false,
    };
  }
}
