import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  GameOperationService,
  GameService,
  NotificationService,
  SeasonInfo,
  SettingsService,
} from '@floorball/core';
import {
  GameDayReportRow,
  GameOperation,
  GameReportStatus,
} from '@floorball/types';
import { downloadCsv } from 'src/app/_helpers/_utils/csv-export';

type ViewMode = 'gameDays' | 'games';

// Ein Spieltag mit seinen Spielen. Die Gruppierung passiert clientseitig über
// game_day_id, damit beide Sichten dieselbe einmal geladene Datenmenge nutzen.
interface GameDayGroup {
  gameDayId: number;
  gameDayNumber: number | null;
  date: string | null;
  leagueName: string | null;
  arenaName: string | null;
  hostingClubName: string | null;
  games: GameDayReportRow[];
  closedCount: number;
  scanRequired: boolean;
  scanCount: number;
  commentCount: number;
  flaggedCount: number;
}

const CLOSED_STATUSES: GameReportStatus[] = [
  'match_record_closed',
  'finalized',
];

@Component({
  templateUrl: './game-day-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class GameDayIndexComponent implements OnInit, OnDestroy {
  rows: GameDayReportRow[] = [];
  groups: GameDayGroup[] = [];
  seasons: SeasonInfo[] = [];
  gameOperations: GameOperation[] = [];

  viewMode: ViewMode = 'gameDays';
  loading = false;
  seasonsLoading = true;
  truncated = false;

  filterSeasonId = '';
  filterGameOperationId = '';
  filterDateFrom = '';
  filterDateTo = '';
  filterStatus = '';

  expandedGameIds = new Set<number>();
  expandedGameDayIds = new Set<number>();

  // Läuft gerade ein Abschluss bzw. ein Scan-Abruf für dieses Spiel?
  finalizingGameId: number | null = null;
  scanLoadingGameId: number | null = null;

  readonly pageSize = 25;
  currentPage = 1;

  private _destroy$ = new Subject<void>();

  constructor(
    private _gameService: GameService,
    private _gameOperationService: GameOperationService,
    private _settingsService: SettingsService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._gameOperationService
      .getAdminGameOperations()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (operations) => {
          this.gameOperations = [...operations].sort((a, b) =>
            (a.name ?? '').localeCompare(b.name ?? '', 'de')
          );
          this._cdr.markForCheck();
        },
        error: () => {
          // Der Spielbetriebs-Filter ist optional; ohne ihn greift der
          // serverseitige Scope weiterhin.
        },
      });

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
    this.currentPage = 1;
    this._load();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.currentPage = 1;
  }

  // --- Aufklappen -----------------------------------------------------------

  toggleGame(gameId: number): void {
    if (this.expandedGameIds.has(gameId)) {
      this.expandedGameIds.delete(gameId);
    } else {
      this.expandedGameIds.add(gameId);
    }
  }

  toggleGameDay(gameDayId: number): void {
    if (this.expandedGameDayIds.has(gameDayId)) {
      this.expandedGameDayIds.delete(gameDayId);
    } else {
      this.expandedGameDayIds.add(gameDayId);
    }
  }

  // --- Paginierung (nur Spielsicht) ----------------------------------------

  get numberOfPages(): number {
    return Math.max(1, Math.ceil(this.rows.length / this.pageSize));
  }

  get pagedRows(): GameDayReportRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.rows.slice(start, start + this.pageSize);
  }

  changePage(page: number): void {
    this.currentPage = page;
  }

  // --- Anzeige-Helfer -------------------------------------------------------

  statusLabel(status: GameReportStatus | null): string {
    return this._transloco.translate(
      `gameDayAdmin.status.${status ?? 'notStarted'}`
    );
  }

  statusClass(status: GameReportStatus | null): string {
    switch (status) {
      case 'finalized':
        return 'bg-green-100 text-green-800';
      case 'match_record_closed':
        return 'bg-yellow-100 text-yellow-800';
      case 'ingame':
      case 'aftergame':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  }

  isClosed(row: GameDayReportRow): boolean {
    return (
      row.game_status !== null && CLOSED_STATUSES.includes(row.game_status)
    );
  }

  // Nur ein zur Kontrolle freigegebener Bericht lässt sich final schließen.
  canFinalize(row: GameDayReportRow): boolean {
    return row.game_status === 'match_record_closed';
  }

  hasFlags(row: GameDayReportRow): boolean {
    const f = row.flags;
    return (
      f.protest ||
      f.forfait ||
      !!f.special_event_string ||
      f.severe_penalty_count > 0 ||
      f.missing_audience ||
      f.missing_signatures ||
      f.missing_referee2
    );
  }

  hasLinkedRecords(row: GameDayReportRow): boolean {
    return (
      !!row.referee_report ||
      !!row.proceeding_proposal ||
      row.checklist_negative_count > 0 ||
      !!row.checklist_veto_submitted_at
    );
  }

  gameRouterLink(row: GameDayReportRow): (string | number)[] | null {
    if (!row.game_operation_slug || !row.league_id) return null;
    return ['/', row.game_operation_slug, row.league_id, 'spiel', row.id];
  }

  // --- Aktionen -------------------------------------------------------------

  // Der Papierbogen-Link wird erst beim Klick geholt: Die Übersicht liefert nur
  // die Metadaten, damit nicht für jede Zeile eine signierte Blob-URL entsteht.
  openScan(row: GameDayReportRow): void {
    if (this.scanLoadingGameId !== null) return;
    this.scanLoadingGameId = row.id;
    this._gameService
      .getGameScan(row.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (scan) => {
          this.scanLoadingGameId = null;
          if (scan?.url) {
            window.open(scan.url, '_blank', 'noopener');
          } else {
            this._notificationService.error(
              this._transloco.translate(
                'gameDayAdmin.notifications.scanMissing'
              )
            );
          }
          this._cdr.markForCheck();
        },
        error: () => {
          this.scanLoadingGameId = null;
          this._notificationService.error(
            this._transloco.translate('gameDayAdmin.notifications.scanError')
          );
          this._cdr.markForCheck();
        },
      });
  }

  finalizeGame(row: GameDayReportRow): void {
    if (this.finalizingGameId !== null) return;
    this.finalizingGameId = row.id;
    this._gameService
      .setGameStatus(row.id, 'finalized')
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.finalizingGameId = null;
          // Lokal aktualisieren statt neu zu laden, damit Filter, Seite und
          // aufgeklappte Zeilen erhalten bleiben.
          row.game_status = 'finalized';
          this._regroup();
          this._notificationService.success(
            this._transloco.translate('gameDayAdmin.notifications.finalized')
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.finalizingGameId = null;
          // Die Fehlermeldung des Servers (z. B. fehlender Schiedsrichter)
          // zeigt bereits der ErrorInterceptor.
          this._cdr.markForCheck();
        },
      });
  }

  exportCsv(): void {
    if (this.rows.length === 0) return;
    const t = (key: string) => this._transloco.translate(key);
    const headers = [
      t('gameDayAdmin.index.colDate'),
      t('gameDayAdmin.index.colTime'),
      t('gameDayAdmin.index.colLeague'),
      t('gameDayAdmin.index.colGameNumber'),
      t('gameDayAdmin.index.colTeams'),
      t('gameDayAdmin.index.colHost'),
      t('gameDayAdmin.index.colStatus'),
      t('gameDayAdmin.index.colClosedAt'),
      t('gameDayAdmin.index.colUpdatedAt'),
      t('gameDayAdmin.index.colUpdatedBy'),
      t('gameDayAdmin.index.colComment'),
      t('gameDayAdmin.index.colScanUploadedAt'),
    ];
    const rows = this.rows.map((r) => [
      r.date ?? '',
      r.start_time ?? '',
      r.league_name ?? '',
      r.game_number ?? '',
      `${r.home_team ?? ''} : ${r.guest_team ?? ''}`,
      r.hosting_club_name ?? '',
      this.statusLabel(r.game_status),
      r.match_record_closed_at ?? '',
      r.record_updated_at ?? '',
      r.record_updated_by_name ?? '',
      r.record_comment ?? '',
      r.scan?.uploaded_at ?? '',
    ]);
    downloadCsv('spieltage', headers, rows);
  }

  // --- Laden ----------------------------------------------------------------

  private _load(): void {
    this.loading = true;
    this._gameService
      .getGameDayReportOverview({
        season_id: this.filterSeasonId || undefined,
        game_operation_id: this.filterGameOperationId || undefined,
        date_from: this.filterDateFrom || undefined,
        date_to: this.filterDateTo || undefined,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.truncated = result.truncated;
          this.rows = this._applyStatusFilter(result.games);
          this._regroup();
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._notificationService.error(
            this._transloco.translate('gameDayAdmin.notifications.loadError'),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  // Der Status wird clientseitig gefiltert: Die Serverantwort ist ohnehin schon
  // auf Saison und Zeitraum eingegrenzt, und beide Sichten teilen sich die Daten.
  private _applyStatusFilter(games: GameDayReportRow[]): GameDayReportRow[] {
    if (!this.filterStatus) return games;
    if (this.filterStatus === 'open') {
      return games.filter(
        (g) =>
          g.game_status === null || !CLOSED_STATUSES.includes(g.game_status)
      );
    }
    if (this.filterStatus === 'withComment') {
      return games.filter((g) => !!g.record_comment);
    }
    return games.filter((g) => g.game_status === this.filterStatus);
  }

  private _regroup(): void {
    const byGameDay = new Map<number, GameDayReportRow[]>();
    for (const row of this.rows) {
      const bucket = byGameDay.get(row.game_day_id);
      if (bucket) {
        bucket.push(row);
      } else {
        byGameDay.set(row.game_day_id, [row]);
      }
    }

    this.groups = [...byGameDay.entries()].map(([gameDayId, games]) => {
      const first = games[0];
      return {
        gameDayId,
        gameDayNumber: first.game_day_number,
        date: first.date,
        leagueName: first.league_name,
        arenaName: first.arena_name,
        hostingClubName: first.hosting_club_name,
        games,
        closedCount: games.filter((g) => this.isClosed(g)).length,
        scanRequired: games.some((g) => g.scan_required),
        scanCount: games.filter((g) => !!g.scan).length,
        commentCount: games.filter((g) => !!g.record_comment).length,
        flaggedCount: games.filter((g) => this.hasFlags(g)).length,
      };
    });
  }
}
