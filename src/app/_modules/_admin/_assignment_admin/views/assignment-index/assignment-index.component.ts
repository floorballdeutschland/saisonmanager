import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
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
  RefereeAssignmentStub,
} from '@floorball/types';

interface RowState {
  referee1Query: string;
  referee2Query: string;
  coachQuery: string;
  selectedReferee1Id: number | null;
  selectedReferee2Id: number | null;
  selectedCoachId: number | null;
  showReferee1Dropdown: boolean;
  showReferee2Dropdown: boolean;
  showCoachDropdown: boolean;
  availableReferees: RefereeAssignmentAvailable[];
  availableCoaches: RefereeAssignmentAvailable[];
  loadingReferees: boolean;
  loadingCoaches: boolean;
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
    private _transloco: TranslocoService,
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

  // CSV-Export der aktuell gefilterten Ansetzungen (Saison/Zeitraum).
  // Semikolon-getrennt + UTF-8-BOM, damit Excel Umlaute korrekt darstellt.
  exportCsv(): void {
    if (this.rows.length === 0) return;
    const t = (key: string) => this._transloco.translate(key);
    const headers = [
      t('assignmentAdmin.index.colDate'),
      t('assignmentAdmin.index.colTime'),
      t('assignmentAdmin.index.colLeague'),
      t('assignmentAdmin.index.csvHome'),
      t('assignmentAdmin.index.csvGuest'),
      t('assignmentAdmin.index.csvArena'),
      t('assignmentAdmin.index.csvHost'),
      t('assignmentAdmin.index.colReferee1'),
      t('assignmentAdmin.index.colReferee2'),
      t('assignmentAdmin.index.colCoach'),
      t('assignmentAdmin.index.colStatus'),
    ];
    const rows = this.rows.map((r) => [
      r.game.date ?? '',
      r.game.start_time ?? '',
      r.game.league ?? '',
      r.game.home_team ?? '',
      r.game.guest_team ?? '',
      r.game.arena ?? '',
      r.game.club ?? r.assignment?.game?.club ?? '',
      this._refereeCsvName(r.assignment?.referee1),
      this._refereeCsvName(r.assignment?.referee2),
      this._refereeCsvName(r.assignment?.coach),
      this.assignmentStatusLabel(r.game.assignment_status),
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
      )
      .join('\r\n');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const blob = new Blob(['﻿' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ansetzungen-${yyyy}-${mm}-${dd}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  private _refereeCsvName(r?: RefereeAssignmentStub | null): string {
    return r ? `${r.nachname}, ${r.vorname}` : '';
  }

  // Warnung, wenn ein in dieser Zeile gewählter Schiri zugleich einem
  // Parallelspiel (gleiches Datum + gleicher Anpfiff) in der aktuellen Liste
  // zugeordnet ist. Rein clientseitig: Sperrtermine und tagesgleiche
  // Doppelansetzungen filtert bereits das Backend aus dem Auswahl-Dropdown
  // (`available`-Endpoint) – diese Prüfung ergänzt die zeitgleiche Kollision,
  // die durch noch nicht gespeicherte/zwischengespeicherte Auswahlen entstehen
  // kann.
  refereeConflict(row: MergedGame): string | null {
    const ids = this._selectedRefereeIds(row.game.id);
    if (ids.length === 0) return null;

    const conflictGames: string[] = [];
    for (const other of this.rows) {
      if (other.game.id === row.game.id) continue;
      if (!this._isParallel(row.game, other.game)) continue;
      const otherIds = this._selectedRefereeIds(other.game.id);
      if (ids.some((id) => otherIds.includes(id))) {
        conflictGames.push(this._gameLabel(other.game));
      }
    }

    if (conflictGames.length === 0) return null;
    return this._transloco.translate('assignmentAdmin.index.conflictParallel', {
      games: conflictGames.join(', '),
    });
  }

  private _selectedRefereeIds(gameId: number): number[] {
    const state = this.rowStates.get(gameId);
    if (!state) return [];
    return [state.selectedReferee1Id, state.selectedReferee2Id].filter(
      (id): id is number => id != null
    );
  }

  private _isParallel(
    a: RefereeAssignableGame,
    b: RefereeAssignableGame
  ): boolean {
    return a.date === b.date && !!a.start_time && a.start_time === b.start_time;
  }

  private _gameLabel(g: RefereeAssignableGame): string {
    const teams = [g.home_team, g.guest_team].filter(Boolean).join(' vs. ');
    return g.game_number ? `#${g.game_number} ${teams}` : teams;
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

  filteredCoaches(gameId: number, query: string): RefereeAssignmentAvailable[] {
    const state = this.rowStates.get(gameId);
    if (!state) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.availableCoaches.filter(
      (r) =>
        r.vorname.toLowerCase().includes(q) ||
        r.nachname.toLowerCase().includes(q)
    );
  }

  onCoachFocus(gameId: number): void {
    const state = this.rowStates.get(gameId);
    if (!state || state.loadingCoaches || state.availableCoaches.length > 0)
      return;
    const row = this.rows.find((r) => r.game.id === gameId);
    if (!row) return;
    state.loadingCoaches = true;
    this._cdr.markForCheck();
    this._refereeService
      .adminGetAvailableCoaches(row.game.date)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (list) => {
          state.availableCoaches = list;
          state.loadingCoaches = false;
          this._cdr.markForCheck();
        },
        error: () => {
          state.loadingCoaches = false;
          this._cdr.markForCheck();
        },
      });
  }

  onCoachInput(gameId: number, value: string): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.coachQuery = value;
    state.selectedCoachId = null;
    state.showCoachDropdown = value.trim().length > 0;
    this._cdr.markForCheck();
  }

  selectCoach(gameId: number, r: RefereeAssignmentAvailable): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.selectedCoachId = r.id;
    state.coachQuery = this._refereeName(r);
    state.showCoachDropdown = false;
    this._cdr.markForCheck();
  }

  clearCoach(gameId: number): void {
    const state = this.rowStates.get(gameId);
    if (!state) return;
    state.selectedCoachId = null;
    state.coachQuery = '';
    state.showCoachDropdown = false;
    this._cdr.markForCheck();
  }

  onCoachBlur(gameId: number): void {
    setTimeout(() => {
      const state = this.rowStates.get(gameId);
      if (!state) return;
      state.showCoachDropdown = false;
      if (!state.selectedCoachId) {
        state.coachQuery = '';
      } else {
        const r = state.availableCoaches.find(
          (x) => x.id === state.selectedCoachId
        );
        if (r) state.coachQuery = this._refereeName(r);
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
      coach_id: state.selectedCoachId,
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
        this._notificationService.success(
          this._transloco.translate('assignmentAdmin.notifications.saved'),
          {
            autoClose: true,
            keepAfterRouteChange: false,
          }
        );
      },
      error: (err) => {
        state.saving = false;
        this._cdr.markForCheck();
        const msg =
          err?.error?.errors?.[0] ||
          this._transloco.translate('assignmentAdmin.notifications.saveError');
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
          this._notificationService.success(
            this._transloco.translate('assignmentAdmin.notifications.notified'),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: () => {
          state.notifying = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'assignmentAdmin.notifications.notifyError'
            ),
            {
              autoClose: false,
              keepAfterRouteChange: false,
            }
          );
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
          this._notificationService.success(
            this._transloco.translate(
              'assignmentAdmin.notifications.published'
            ),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: () => {
          state.publishing = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'assignmentAdmin.notifications.publishError'
            ),
            {
              autoClose: false,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }

  assignmentStatusLabel(status?: string | null): string {
    if (!status)
      return this._transloco.translate('assignmentAdmin.index.statusOpen');
    return status === 'published'
      ? this._transloco.translate('assignmentAdmin.index.statusPublished')
      : this._transloco.translate('assignmentAdmin.index.statusDraft');
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
            this._transloco.translate(
              'assignmentAdmin.notifications.loadError'
            ),
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
    const coach = assignment?.coach ?? null;
    return {
      referee1Query: ref1 ? this._refereeName(ref1) : '',
      referee2Query: ref2 ? this._refereeName(ref2) : '',
      coachQuery: coach ? this._refereeName(coach) : '',
      selectedReferee1Id: ref1?.id ?? null,
      selectedReferee2Id: ref2?.id ?? null,
      selectedCoachId: coach?.id ?? null,
      showReferee1Dropdown: false,
      showReferee2Dropdown: false,
      showCoachDropdown: false,
      availableReferees: [],
      availableCoaches: [],
      loadingReferees: false,
      loadingCoaches: false,
      saving: false,
      notifying: false,
      publishing: false,
    };
  }
}
