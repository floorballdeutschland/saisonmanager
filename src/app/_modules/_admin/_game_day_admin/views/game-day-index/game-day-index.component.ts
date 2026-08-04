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
  // `games` sind die zum Filter passenden Zeilen, die Zähler beziehen sich auf
  // den vollständigen Spieltag.
  games: GameDayReportRow[];
  totalCount: number;
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
  gameOperations: GameOperation[] = [];

  viewMode: ViewMode = 'gameDays';
  loading = false;
  truncated = false;

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

  // Ungefilterte Serverantwort. Der Statusfilter wirkt clientseitig darauf,
  // damit die Spieltags-Kennzahlen den echten Spieltag abbilden.
  private _allRows: GameDayReportRow[] = [];
  // Serverseitige Filter der zuletzt geholten Antwort – nur wenn sich einer davon
  // ändert, muss neu geladen werden.
  private _loadedKey: string | null = null;
  private _destroy$ = new Subject<void>();

  constructor(
    private _gameService: GameService,
    private _gameOperationService: GameOperationService,
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

    // Die Saison ist serverseitig fest auf die laufende gebunden, es gibt hier
    // also nichts vorzubelegen und nichts abzuwarten.
    this._load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  applyFilter(): void {
    this.currentPage = 1;
    // Der Status wird clientseitig ausgewertet: Wenn sich nur er geändert hat,
    // genügt ein Neugruppieren der bereits geladenen Daten.
    if (
      this._loadedKey !== null &&
      this._loadedKey === this._serverFilterKey()
    ) {
      this._applyFilterAndGroup();
      return;
    }
    this._load();
  }

  private _serverFilterKey(): string {
    return [
      this.filterGameOperationId,
      this.filterDateFrom,
      this.filterDateTo,
    ].join('|');
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
    // Defensiv: Diese Methode läuft beim Gruppieren über jede Zeile. Wirft sie,
    // bricht der Ladevorgang stumm ab und die Seite bleibt auf „lädt" stehen –
    // dieselbe Falle wie beim Spielorte-Suchfeld. Zeilen, die der Server als
    // fehlerhaft markiert, tragen kein `flags`-Objekt.
    const f = row.flags;
    if (!f) return false;
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
    // Das Fenster muss synchron im Klick-Handler geöffnet werden. Erst im
    // HTTP-Callback zu öffnen, kostet die Nutzerinteraktion – der Popup-Blocker
    // schluckt den Aufruf dann kommentarlos, und der Knopf tut scheinbar nichts.
    const tab = window.open('', '_blank', 'noopener');
    this._gameService
      .getGameScan(row.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (scan) => {
          this.scanLoadingGameId = null;
          if (scan?.url) {
            if (tab) {
              tab.location.href = scan.url;
            } else {
              // Popup-Blocker war schneller: im selben Tab öffnen.
              window.location.href = scan.url;
            }
          } else {
            tab?.close();
            this._notificationService.error(
              this._transloco.translate(
                'gameDayAdmin.notifications.scanMissing'
              )
            );
          }
          this._cdr.markForCheck();
        },
        error: () => {
          tab?.close();
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
          // aufgeklappte Zeilen erhalten bleiben. Neu filtern und gruppieren,
          // damit die Zeile unter „Noch nicht abgeschlossen" verschwindet, statt
          // dem aktiven Filter zu widersprechen.
          row.game_status = 'finalized';
          this._applyFilterAndGroup();
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
    const key = this._serverFilterKey();
    this._gameService
      .getGameDayReportOverview({
        game_operation_id: this.filterGameOperationId || undefined,
        date_from: this.filterDateFrom || undefined,
        date_to: this.filterDateTo || undefined,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.truncated = result.truncated;
          this._allRows = result.games ?? [];
          this._loadedKey = key;
          this._applyFilterAndGroup();
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
  private _matchesStatus(row: GameDayReportRow): boolean {
    if (!this.filterStatus) return true;
    if (this.filterStatus === 'open') {
      return (
        row.game_status === null || !CLOSED_STATUSES.includes(row.game_status)
      );
    }
    if (this.filterStatus === 'withComment') return !!row.record_comment;
    return row.game_status === this.filterStatus;
  }

  // Der Statusfilter wirkt auf die angezeigten Zeilen, NICHT auf die Kennzahlen
  // des Spieltags: „3/4 Berichte abgeschlossen" muss den echten Spieltag zählen.
  // Würde über die gefilterte Menge gruppiert, meldete ein Spieltag unter dem
  // Filter „Noch nicht abgeschlossen" stets „0/n abgeschlossen".
  private _applyFilterAndGroup(): void {
    this.rows = this._allRows.filter((row) => this._matchesStatus(row));

    const byGameDay = new Map<number, GameDayReportRow[]>();
    for (const row of this._allRows) {
      const bucket = byGameDay.get(row.game_day_id);
      if (bucket) {
        bucket.push(row);
      } else {
        byGameDay.set(row.game_day_id, [row]);
      }
    }

    this.groups = [...byGameDay.entries()]
      .map(([gameDayId, all]) => {
        const first = all[0];
        return {
          gameDayId,
          gameDayNumber: first.game_day_number,
          date: first.date,
          leagueName: first.league_name,
          arenaName: first.arena_name,
          hostingClubName: first.hosting_club_name,
          // Aufgelistet werden nur die zum Filter passenden Spiele …
          games: all.filter((row) => this._matchesStatus(row)),
          // … gezählt wird über den vollständigen Spieltag.
          totalCount: all.length,
          closedCount: all.filter((g) => this.isClosed(g)).length,
          scanRequired: all.some((g) => g.scan_required),
          scanCount: all.filter((g) => !!g.scan).length,
          commentCount: all.filter((g) => !!g.record_comment).length,
          flaggedCount: all.filter((g) => this.hasFlags(g)).length,
        };
      })
      .filter((group) => group.games.length > 0);
  }
}
