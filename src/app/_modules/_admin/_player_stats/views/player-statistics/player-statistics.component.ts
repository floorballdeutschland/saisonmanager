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
import { Title } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { TranslocoService } from '@jsverse/transloco';
import * as Sentry from '@sentry/angular';
import { PlayerService } from '@floorball/core';
import {
  PlayerStatisticsEntry,
  PlayerStatisticsExportResponse,
  PlayerStatisticsErrorBody,
  PlayerStatisticsFilterOptions,
  PlayerStatisticsGenderFilter,
  PlayerStatisticsLeagueOption,
  PlayerStatisticsQuery,
  PlayerStatisticsScope,
  PlayerStatisticsSortKey,
} from '@floorball/types';
import { isHandledHttpNoise } from 'src/app/_helpers/_utils/filtering-error-handler';
import { CsvCell, downloadCsv } from 'src/app/_helpers/_utils/csv-export';

/**
 * Vorbelegung der Filter, an einer Stelle.
 *
 * Sie steht sonst dreifach da: im Feldinitialisierer, in `resetFilters` und in
 * `hasActiveFilters`. Der Initialisierer ist dabei fuer den ersten Ladevorgang
 * ohnehin wirkungslos, weil die Routen-Zeichnung immer `resetFilters` ruft --
 * wer nur ihn aendert, aendert nichts und merkt es nicht.
 */
const DEFAULTS = {
  minGames: 1,
  includeDeactivated: false,
  onlyCurrentMembers: true,
} as const;

/**
 * Spielerdaten-Rangliste, saisonuebergreifend (Issue #300, API api#465).
 *
 * Eine Komponente fuer beide Wege: Mit `:clubId` in der Route zaehlt sie den
 * Bestand eines Vereins (Einstieg aus der Vereins-Spielerliste), ohne ihn den
 * eigenen Spielbetrieb (Einstieg aus der Spielersuche). Der Unterschied ist ein
 * Parameter am selben Endpunkt und keine zweite Rechnung; die API entscheidet
 * ueber die Rechte und weist einen fremden Verein mit 403 ab.
 *
 * Sortiert und geblaettert wird serverseitig -- eine Verbandsliste kann
 * fuenfstellig sein, und dieselbe Person darf beim Blaettern nicht zweimal
 * auftauchen.
 */
@Component({
  templateUrl: './player-statistics.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PlayerStatisticsComponent implements OnInit, OnDestroy {
  /**
   * Seitengroesse. Muss zur Vorbelegung der API passen, weil Rangnummer und
   * Seitenzahl damit rechnen -- deshalb kein `readonly`: Jede Antwort traegt
   * ihr `per_page` mit, und das gilt. Sonst verschoebe eine Aenderung der
   * API-Vorbelegung (oder ihre Obergrenze) beides stillschweigend.
   */
  perPage = 50;

  clubId: number | null = null;
  scope: PlayerStatisticsScope | null = null;
  entries: PlayerStatisticsEntry[] = [];
  /**
   * Die Auswahllisten kommen nur mit der ersten Seite. Beim Blaettern bleibt
   * deshalb der zuletzt gelieferte Satz stehen, sonst raeumte Seite 2 alle
   * Filterfelder ab.
   *
   * Sie haengen am Blick, und zum Blick gehoert in der Verbandsansicht der
   * Vereinsfilter: `club_filter_id` laeuft in der API ueber `counted_club_ids`
   * in `scope_rows`, und `filter_options` haengt daran. Eine Antwort mit
   * gesetztem Vereinsfilter traegt deshalb GESCHRUMPFTE Listen -- das
   * Vereins-Dropdown enthaelt dann nur noch den gewaehlten Verein, und Saisons
   * oder Altersklassen, in denen dieser Verein nie gespielt hat, verschwinden
   * aus der Maske, ohne aus der Abfrage zu verschwinden. Deshalb uebernimmt
   * `_applyFilterOptions` sie in diesem Fall nicht.
   */
  filterOptions: PlayerStatisticsFilterOptions | null = null;
  asOf: string | null = null;
  total = 0;
  page = 1;
  loading = false;
  /** Gescheiterter Abruf -- von „keine Treffer" zu unterscheiden. */
  loadError: string | null = null;

  /**
   * Laufender Export. Der eigene Zustand statt `loading`: Der Export ruft einen
   * zweiten Endpunkt, und die Tabelle soll dabei stehenbleiben.
   */
  exporting = false;

  /**
   * Steht eine Filteraenderung noch im Debounce-Fenster? Such- und
   * Mindestspielfeld wirken erst nach 300 ms auf `search` bzw. `minGames`. In
   * diesem Fenster zeigte der Export-Knopf keinen Ladezustand und lieferte die
   * Datei zum VORIGEN Filterstand: „10" tippen, sofort klicken, und im CSV
   * standen alle Personen mit einem Einsatz, waehrend die Tabelle 300 ms
   * spaeter die Auswahl mit 10 zeigte. Eine Datei, die vollstaendig aussieht
   * und nicht zur Maske passt, ist schlimmer als ein kurz gesperrter Knopf.
   */
  filterPending = false;
  exportError: string | null = null;
  /** Die Datei endet an der Obergrenze der API -- darunter liegt noch etwas. */
  exportTruncated = false;

  seasonIds: string[] = [];
  gameOperationId: number | null = null;
  leagueId: number | null = null;
  leagueClassId: string | null = null;
  teamId: number | null = null;
  clubFilterId: number | null = null;
  gender: PlayerStatisticsGenderFilter | null = null;
  minGames: number = DEFAULTS.minGames;
  includeDeactivated: boolean = DEFAULTS.includeDeactivated;
  onlyCurrentMembers: boolean = DEFAULTS.onlyCurrentMembers;
  search = '';

  sortKey: PlayerStatisticsSortKey = 'games';
  sortDir: 'asc' | 'desc' = 'desc';

  private _load$ = new Subject<void>();
  private _search$ = new Subject<string>();
  private _minGames$ = new Subject<string>();
  private _destroy$ = new Subject<void>();

  constructor(
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _title: Title,
    private _transloco: TranslocoService
  ) {
    this._title.setTitle('Spielerdaten – Floorball Saisonmanager');
  }

  ngOnInit(): void {
    this._load$
      .pipe(
        switchMap(() => {
          this.loading = true;
          this.loadError = null;
          this._cdr.markForCheck();
          return this._playerService.getPlayerStatistics(this.query).pipe(
            // Der Fehler wird INNERHALB des switchMap abgefangen, sonst endet
            // der Strom und jede weitere Filteraenderung liefe ins Leere.
            catchError((err: HttpErrorResponse) => {
              this.loadError = this._errorMessage(err);
              this._reportFailure(err);
              return of(null);
            })
          );
        }),
        takeUntil(this._destroy$)
      )
      .subscribe((response) => {
        this.loading = false;
        if (response) {
          this.scope = response.scope;
          this.entries = response.players ?? [];
          this.asOf = response.as_of;
          // Number(): Eine Antwort ohne diese Felder machte `numberOfPages` zu
          // NaN, und dann verschwindet die Blaetterleiste samt der Personen
          // dahinter, statt dass etwas auffaellt.
          this.total = Number(response.total) || 0;
          this.page = Number(response.page) || 1;
          this.perPage = Number(response.per_page) || this.perPage;
          this._applyFilterOptions(response.filters);
        } else {
          this.entries = [];
          this.total = 0;
        }
        this._cdr.markForCheck();
      });

    // Debounce im Strom und nicht per setTimeout: Sonst schickt jeder Tastendruck
    // eine Abfrage ueber den ganzen Landesverband.
    //
    // Bewusst OHNE `distinctUntilChanged`: `resetFilters` und der Vereinswechsel
    // setzen `search` direkt und lassen den Strom unberuehrt. Der wuerde dann
    // denselben Begriff, ein zweites Mal getippt, als Wiederholung verwerfen --
    // im Feld stuende ein Name und darunter die ungefilterte Rangliste, ohne
    // dass etwas scheitert. Der Debounce allein reicht gegen Tastendruck-Fluten.
    this._search$
      .pipe(debounceTime(300), takeUntil(this._destroy$))
      .subscribe((value) => {
        this.filterPending = false;
        this.search = value;
        this.reload();
      });

    // Dasselbe fuer die Mindestzahl: Ohne Debounce ist „25" auf „3" korrigieren
    // (zweimal Ruecktaste) zwei Aggregatabfragen ueber den ganzen Spielbetrieb,
    // und die Korrektur auf 1 landete mitten in der Eingabe im Feld.
    this._minGames$
      .pipe(debounceTime(300), takeUntil(this._destroy$))
      .subscribe((value) => {
        this.filterPending = false;
        const parsed = Number(value);
        // Der geklemmte Wert geht zurueck in das Feld (`[ngModel]` ist einwegig,
        // die Zuweisung plus markForCheck schreibt ihn), damit dort nicht eine
        // 0 steht, waehrend mit 1 gefiltert wird.
        this.minGames =
          Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
        this.reload();
      });

    this._route.paramMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      const raw = params.get('clubId');
      this.clubId = raw ? Number(raw) : null;
      // Anderer Verein heisst anderer Blick: Auswahllisten, Filter und der
      // Kopf gehoeren dem alten und passen nicht mehr. Ohne das Nullen von
      // `scope` stuende bis zur Antwort der Name des vorigen Vereins da.
      this.filterOptions = null;
      this.scope = null;
      this.resetFilters();
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get query(): PlayerStatisticsQuery {
    return {
      club_id: this.clubId,
      club_filter_id: this.clubId ? null : this.clubFilterId,
      season_id: this.seasonIds,
      game_operation_id: this.gameOperationId,
      league_id: this.leagueId,
      league_class_id: this.leagueClassId,
      team_id: this.teamId,
      gender: this.gender,
      min_games: this.minGames,
      include_deactivated: this.includeDeactivated,
      only_current_members: this.onlyCurrentMembers,
      q: this.search.trim(),
      sort: this.sortKey,
      sort_dir: this.sortDir,
      page: this.page,
      per_page: this.perPage,
    };
  }

  get isAssociationMode(): boolean {
    return this.clubId === null;
  }

  get numberOfPages(): number {
    return Math.max(1, Math.ceil(this.total / this.perPage));
  }

  /** Erste Zeile der aktuellen Seite, fuer die laufende Nummer der Rangliste. */
  get firstRank(): number {
    return (this.page - 1) * this.perPage + 1;
  }

  /**
   * Ligen der gewaehlten Saisons und Spielklasse. Ueber alle Saisons hinweg ist
   * die Liste sonst lang und voll gleichnamiger Eintraege verschiedener Jahre.
   */
  get visibleLeagues(): PlayerStatisticsLeagueOption[] {
    const leagues = this.filterOptions?.leagues ?? [];
    return leagues.filter(
      (league) =>
        (!this.seasonIds.length || this.seasonIds.includes(league.season_id)) &&
        (!this.leagueClassId || league.league_class_id === this.leagueClassId)
    );
  }

  /**
   * Ab wann ein Suchfeld statt eines Dropdowns. Die Schwelle ist die Hoehe, ab
   * der eine aufgeklappte Liste nicht mehr auf einen Blick zu ueberfliegen ist;
   * die Vereinsliste der Verbandsansicht bekommt es immer, sie ist nie kurz.
   */
  needsSearch(count: number): boolean {
    return count > 8;
  }

  seasonName(seasonId: string | null): string {
    if (!seasonId) return '';
    const season = this.filterOptions?.seasons.find((s) => s.id === seasonId);
    return season?.name ?? seasonId;
  }

  /**
   * Erste bis letzte Saison mit Einsatz. Beide IDs koennen fehlen (die API
   * rechnet sie nur aus Saison-IDs, die numerisch lesbar sind), und dann darf
   * kein halber Zeitraum mit fuehrendem Trenner herauskommen.
   */
  period(entry: PlayerStatisticsEntry): string {
    const first = this.seasonName(entry.first_season_id);
    const last = this.seasonName(entry.last_season_id);
    if (!first && !last) return '–';
    if (!first || !last || first === last) return first || last;
    return `${first} – ${last}`;
  }

  /**
   * Der Verein, in dessen Pflegemaske der Bearbeiten-Link fuehrt. In der
   * Verbandsansicht ist das der laufende Heimatverein aus dem Schnappschuss;
   * fehlt er, entfaellt der Link (die Maske braucht einen Verein im Pfad).
   */
  editClubId(
    entry: Pick<PlayerStatisticsEntry, 'home_club_id'>
  ): number | null {
    return this.clubId ?? entry.home_club_id ?? null;
  }

  sortBy(key: PlayerStatisticsSortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortKey = key;
      // Namen liest man aufsteigend, Zahlen von oben.
      this.sortDir = key === 'name' ? 'asc' : 'desc';
    }
    this.reload();
  }

  sortIndicator(key: PlayerStatisticsSortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDir === 'desc' ? '▾' : '▴';
  }

  toggleSeason(seasonId: string): void {
    this.seasonIds = this.seasonIds.includes(seasonId)
      ? this.seasonIds.filter((id) => id !== seasonId)
      : [...this.seasonIds, seasonId];
    this._dropInvisibleLeague();
    this.reload();
  }

  onSearchChange(value: string): void {
    this.filterPending = true;
    this._search$.next(value);
  }

  onFilterChange(): void {
    this._dropInvisibleLeague();
    this.reload();
  }

  /**
   * Untergrenze 1 statt 0: Die API laesst `min_games=0` zu und nimmt dann auch
   * Zeilen ohne Einsatz mit. Quoten aus sehr wenigen Spielen filtert man ueber
   * einen HOEHEREN Wert in diesem Feld, nicht hier.
   */
  onMinGamesChange(value: string): void {
    this.filterPending = true;
    this._minGames$.next(value);
  }

  resetFilters(): void {
    this.seasonIds = [];
    this.gameOperationId = null;
    this.leagueId = null;
    this.leagueClassId = null;
    this.teamId = null;
    this.clubFilterId = null;
    this.gender = null;
    this.minGames = DEFAULTS.minGames;
    this.includeDeactivated = DEFAULTS.includeDeactivated;
    this.onlyCurrentMembers = DEFAULTS.onlyCurrentMembers;
    this.search = '';
    this.reload();
  }

  get hasActiveFilters(): boolean {
    return (
      this.seasonIds.length > 0 ||
      this.gameOperationId !== null ||
      this.leagueId !== null ||
      this.leagueClassId !== null ||
      this.teamId !== null ||
      this.clubFilterId !== null ||
      this.gender !== null ||
      this.minGames !== DEFAULTS.minGames ||
      this.includeDeactivated !== DEFAULTS.includeDeactivated ||
      this.onlyCurrentMembers !== DEFAULTS.onlyCurrentMembers ||
      this.search.trim() !== ''
    );
  }

  /** Jede Aenderung an Filter oder Sortierung beginnt wieder bei Seite 1. */
  reload(): void {
    this.page = 1;
    // Beide Meldungen gehoeren zur vorigen Auswahl und wuerden ueber einer
    // anderen Liste etwas Falsches behaupten.
    this.exportError = null;
    this.exportTruncated = false;
    this._load$.next();
  }

  changePage(page: number): void {
    this.page = page;
    this._load$.next();
  }

  /**
   * Die Abfrage des Exports: dieselbe wie die der Liste, ohne die Blaetterung.
   * Der Endpunkt kennt `page`/`per_page` nicht, und mitgeschickt behaupteten sie,
   * die Datei bekaeme nur die sichtbare Seite.
   */
  get exportQuery(): PlayerStatisticsQuery {
    const query = { ...this.query };
    delete query.page;
    delete query.per_page;
    return query;
  }

  /**
   * Die aktuelle Filterauswahl als CSV -- alle Treffer, nicht die sichtbare
   * Seite. Deshalb ein eigener Abruf und nicht `entries`: Auf dem Schirm stehen
   * 50 Zeilen, in einer Verbandsansicht koennen es fuenfstellig viele sein.
   */
  exportCsv(): void {
    if (this.exporting || this.filterPending) return;

    this.exporting = true;
    this.exportError = null;
    this.exportTruncated = false;
    this._cdr.markForCheck();

    this._playerService
      .exportPlayerStatistics(this.exportQuery)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this.exporting = false;
          this.exportTruncated = response.truncated === true;
          this._downloadCsv(response);
          this._cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.exporting = false;
          this.exportError = this._errorMessage(err, 'playerStats.exportError');
          this._reportFailure(err, 'export');
          this._cdr.markForCheck();
        },
      });
  }

  /**
   * Spalten wie die Tabelle, mit drei Zugaben, die im Tabellenblatt zaehlen:
   * Vor- und Nachname getrennt (sortierbar), der Zeitraum als zwei Spalten
   * (filterbar) und die Spieler-ID, ueber die eine Zeile eindeutig bleibt, wenn
   * zwei Personen gleich heissen.
   */
  private _downloadCsv(response: PlayerStatisticsExportResponse): void {
    const t = (key: string) => this._transloco.translate(key);
    const headers = [
      t('playerStats.csv.lastName'),
      t('playerStats.csv.firstName'),
      ...(this.isAssociationMode ? [t('playerStats.columns.club')] : []),
      t('playerStats.columns.games'),
      t('playerStats.columns.goals'),
      t('playerStats.columns.assists'),
      t('playerStats.columns.points'),
      t('playerStats.columns.pointsPerGame'),
      t('playerStats.csv.penaltyMinutes'),
      t('playerStats.csv.firstSeason'),
      t('playerStats.csv.lastSeason'),
      t('playerStats.csv.deactivated'),
      t('playerStats.csv.playerId'),
    ];

    const rows: CsvCell[][] = response.players.map((entry) => [
      entry.last_name,
      entry.first_name,
      ...(this.isAssociationMode ? [entry.home_club ?? ''] : []),
      entry.games,
      entry.goals,
      entry.assists,
      entry.scorer_points,
      this._decimal(entry.scorer_per_game),
      entry.penalty_minutes,
      this.seasonName(entry.first_season_id),
      this.seasonName(entry.last_season_id),
      entry.deactivated_at ? t('playerStats.csv.yes') : t('playerStats.csv.no'),
      entry.player_id,
    ]);

    downloadCsv('spielerdaten', headers, rows);
  }

  /**
   * Dezimalkomma statt Punkt. Die Datei ist auf die deutsche Locale gebaut
   * (Semikolon als Trennzeichen, siehe `csv-export`), und dort liest Excel
   * „1.75" als Text und macht aus „1.5" ein Datum.
   */
  private _decimal(value: number): string {
    return (Number(value) || 0).toFixed(2).replace('.', ',');
  }

  /**
   * Uebernimmt die Auswahllisten einer Antwort, aber nicht die geschrumpften.
   * Warum, steht an `filterOptions`.
   */
  private _applyFilterOptions(
    filters: PlayerStatisticsFilterOptions | undefined
  ): void {
    if (!filters) return;
    if (this.isAssociationMode && this.clubFilterId !== null) return;

    this.filterOptions = filters;
  }

  /**
   * Der Text im Fehlerkasten.
   *
   * Nur Zeichenketten aus der Antwort: Scheitert das Parsen einer Antwort, legt
   * Angular in `err.error.error` das SyntaxError-Objekt ab, und `??` liefe
   * daran vorbei -- im Kasten stuende dann „SyntaxError: Unexpected token '<'".
   * Ein Hash (Validierungsfehler ohne `full_messages`) ergaebe
   * „[object Object]". Beides ist im ErrorInterceptor schon einmal gelernt
   * worden (`readableDetail`).
   */
  private _errorMessage(
    err: HttpErrorResponse,
    fallbackKey = 'playerStats.loadError'
  ): string {
    const body = err?.error as PlayerStatisticsErrorBody | null | undefined;
    const detail = body?.error ?? body?.message;
    return typeof detail === 'string' && detail.trim()
      ? detail
      : this._transloco.translate(fallbackKey);
  }

  /**
   * Der `catchError` nimmt den Fehler aus Angulars `ErrorHandler` und damit aus
   * Sentry. Fuer die Status, die das Projekt gemeldet haben will (404 und 5xx,
   * siehe `FilteringErrorHandler`), wird er deshalb hier von Hand gemeldet.
   *
   * Ausgenommen der 503 dieses Endpunkts: Den meldet die API selbst mit
   * Stapelspur (`Sentry.capture_exception` in `PlayerStatisticsController`),
   * und beide Seiten teilen ein Sentry-Projekt.
   */
  private _reportFailure(err: HttpErrorResponse, action = 'index'): void {
    console.error(
      `HTTP ${err?.status}: GET admin/player_statistics (${action})`
    );
    if (err?.status === 503 || isHandledHttpNoise(err)) return;

    Sentry.captureException(err);
  }

  /** Nach einem gescheiterten Abruf: dieselbe Abfrage noch einmal. */
  retry(): void {
    this._load$.next();
  }

  /**
   * Eine Liga, die nach der neuen Saison- oder Spielklassenwahl gar nicht mehr
   * zur Auswahl steht, bliebe sonst als unsichtbarer Filter stehen und lieferte
   * eine leere Liste ohne erkennbaren Grund.
   */
  private _dropInvisibleLeague(): void {
    if (
      this.leagueId !== null &&
      !this.visibleLeagues.some((league) => league.id === this.leagueId)
    ) {
      this.leagueId = null;
    }
  }
}
