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

// Der Server sortiert absteigend, und das bleibt auch so: Beim Deckeln auf
// MAX_ROWS sollen die ältesten Spieltage wegfallen, nicht die aktuellen.
// Gearbeitet wird die Liste aber von vorn ab, der älteste offene Bericht ist
// der dringendste – deshalb wird sie hier gedreht.
//
// Datum und Anwurfzeit sind Textspalten, die Spielnummer ebenfalls und in
// K.-o.-Runden auch mal „HF1" oder „FIN". Leere und nicht deutbare Werte hängen
// sich hinten an, statt die Liste anzuführen.
function byDateAscending(a: GameDayReportRow, b: GameDayReportRow): number {
  return (
    compareText(a.date, b.date) ||
    compareText(a.start_time, b.start_time) ||
    compareNumeric(a.game_number, b.game_number) ||
    a.id - b.id
  );
}

function compareText(a: string | null, b: string | null): number {
  const left = a || '';
  const right = b || '';
  if (!left || !right) return (left ? 0 : 1) - (right ? 0 : 1);
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumeric(a: string | null, b: string | null): number {
  const left = /^\d+$/.test(a ?? '') ? Number(a) : null;
  const right = /^\d+$/.test(b ?? '') ? Number(b) : null;
  if (left === null || right === null) {
    return (left === null ? 1 : 0) - (right === null ? 1 : 0);
  }
  return left - right;
}

@Component({
  templateUrl: './match-report-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MatchReportIndexComponent implements OnInit, OnDestroy {
  rows: GameDayReportRow[] = [];
  groups: GameDayGroup[] = [];
  gameOperations: GameOperation[] = [];

  viewMode: ViewMode = 'gameDays';
  loading = false;
  truncated = false;

  filterGameOperationId = '';
  filterLeagueId = '';
  filterDateFrom = '';
  filterDateTo = '';
  filterStatus = '';

  // Die Ligen der geladenen Antwort, für den Filter. Bewusst aus den Zeilen
  // statt aus einem eigenen Abruf: Die Übersicht hat die Liste ohnehin schon
  // vollständig da, und so kann der Filter gar keine Liga anbieten, zu der es
  // im aktuellen Zeitraum nichts zu sehen gibt.
  leagues: { id: number; name: string }[] = [];

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
      `matchReportAdmin.status.${status ?? 'notStarted'}`
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
                'matchReportAdmin.notifications.scanMissing'
              )
            );
          }
          this._cdr.markForCheck();
        },
        error: () => {
          tab?.close();
          this.scanLoadingGameId = null;
          this._notificationService.error(
            this._transloco.translate(
              'matchReportAdmin.notifications.scanError'
            )
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
            this._transloco.translate(
              'matchReportAdmin.notifications.finalized'
            )
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
      t('matchReportAdmin.index.colDate'),
      t('matchReportAdmin.index.colTime'),
      t('matchReportAdmin.index.colLeague'),
      t('matchReportAdmin.index.colGameNumber'),
      t('matchReportAdmin.index.colTeams'),
      t('matchReportAdmin.index.colHost'),
      t('matchReportAdmin.index.colStatus'),
      t('matchReportAdmin.index.colClosedAt'),
      t('matchReportAdmin.index.colUpdatedAt'),
      t('matchReportAdmin.index.colUpdatedBy'),
      t('matchReportAdmin.index.colComment'),
      t('matchReportAdmin.index.colScanUploadedAt'),
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
          this._allRows = [...(result.games ?? [])].sort(byDateAscending);
          this._loadedKey = key;
          this._collectLeagues();
          this._applyFilterAndGroup();
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._notificationService.error(
            this._transloco.translate(
              'matchReportAdmin.notifications.loadError'
            ),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  // Die Ligenliste stammt aus der ungefilterten Antwort, nicht aus der
  // angezeigten Menge: Sonst bliebe nach dem Setzen des Filters nur noch die
  // eine gewählte Liga zur Auswahl.
  //
  // Verschwindet die gewählte Liga durch einen neuen Zeitraum, fällt der Filter
  // zurück auf „Alle". Ohne das stünde eine leere Liste da, deren Grund im
  // Auswahlfeld nicht mehr abzulesen wäre.
  private _collectLeagues(): void {
    const byId = new Map<number, string>();
    for (const row of this._allRows) {
      if (row.league_id != null) {
        byId.set(row.league_id, row.league_name ?? String(row.league_id));
      }
    }

    this.leagues = [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    if (this.filterLeagueId && !byId.has(Number(this.filterLeagueId))) {
      this.filterLeagueId = '';
    }
  }

  // Wie der Status clientseitig: Die Serverantwort ist ohnehin schon geladen,
  // und der `league_id`-Parameter der API würde nur einen zweiten Abruf kosten.
  //
  // Anders als der Status wirkt die Liga VOR der Gruppierung. Ein Spieltag
  // gehört genau zu einer Liga, fällt also ganz heraus oder ganz hinein – die
  // Kennzahlen des Spieltags bleiben damit richtig.
  private _matchesLeague(row: GameDayReportRow): boolean {
    if (!this.filterLeagueId) return true;
    return String(row.league_id ?? '') === this.filterLeagueId;
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
    const inScope = this._allRows.filter((row) => this._matchesLeague(row));
    this.rows = inScope.filter((row) => this._matchesStatus(row));

    const byGameDay = new Map<number, GameDayReportRow[]>();
    for (const row of inScope) {
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
