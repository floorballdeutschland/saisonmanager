import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { TranslocoService } from '@jsverse/transloco';
import { PlayerService } from '@floorball/core';
import {
  PlayerStatisticsEntry,
  PlayerStatisticsFilterOptions,
  PlayerStatisticsLeagueOption,
  PlayerStatisticsQuery,
  PlayerStatisticsScope,
  PlayerStatisticsSortKey,
} from '@floorball/types';

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
  readonly perPage = 50;

  clubId: number | null = null;
  scope: PlayerStatisticsScope | null = null;
  entries: PlayerStatisticsEntry[] = [];
  /**
   * Die Auswahllisten kommen nur mit der ersten Seite -- sie haengen am Blick
   * und nicht an den gesetzten Filtern. Beim Blaettern bleibt deshalb der
   * zuletzt gelieferte Satz stehen, sonst raeumte Seite 2 alle Filterfelder ab.
   */
  filterOptions: PlayerStatisticsFilterOptions | null = null;
  asOf: string | null = null;
  total = 0;
  page = 1;
  loading = false;
  /** Gescheiterter Abruf -- von „keine Treffer" zu unterscheiden. */
  loadError: string | null = null;

  seasonIds: string[] = [];
  gameOperationId: number | null = null;
  leagueId: number | null = null;
  leagueClassId: string | null = null;
  teamId: number | null = null;
  clubFilterId: number | null = null;
  gender: string | null = null;
  minGames = 1;
  includeDeactivated = false;
  onlyCurrentMembers = true;
  search = '';

  sortKey: PlayerStatisticsSortKey = 'games';
  sortDir: 'asc' | 'desc' = 'desc';

  private _load$ = new Subject<void>();
  private _search$ = new Subject<string>();
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
            catchError((err) => {
              this.loadError =
                err?.error?.error ??
                err?.error?.message ??
                this._transloco.translate('playerStats.loadError');
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
          this.entries = response.players;
          this.asOf = response.as_of;
          this.total = response.total;
          this.page = response.page;
          if (response.filters) {
            this.filterOptions = response.filters;
          }
        } else {
          this.entries = [];
          this.total = 0;
        }
        this._cdr.markForCheck();
      });

    // Debounce im Strom und nicht per setTimeout: Sonst schickt jeder Tastendruck
    // eine Abfrage ueber den ganzen Landesverband.
    this._search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this._destroy$)
      )
      .subscribe((value) => {
        this.search = value;
        this.reload();
      });

    this._route.paramMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      const raw = params.get('clubId');
      this.clubId = raw ? Number(raw) : null;
      // Anderer Verein heisst anderer Blick: Auswahllisten und Filter gehoeren
      // dem alten und passen nicht mehr.
      this.filterOptions = null;
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

  /** Lange Auswahllisten bekommen ein Suchfeld statt eines reinen Dropdowns. */
  needsSearch(count: number): boolean {
    return count > 8;
  }

  seasonName(seasonId: string | null): string {
    if (!seasonId) return '';
    const season = this.filterOptions?.seasons.find((s) => s.id === seasonId);
    return season?.name ?? seasonId;
  }

  /** „2021/2022 – 2025/2026", bei nur einer Saison deren Name allein. */
  period(entry: PlayerStatisticsEntry): string {
    const first = this.seasonName(entry.first_season_id);
    const last = this.seasonName(entry.last_season_id);
    if (!first && !last) return '–';
    if (!last || first === last) return first || last;
    return `${first} – ${last}`;
  }

  /**
   * Der Verein, in dessen Pflegemaske der Bearbeiten-Link fuehrt. In der
   * Verbandsansicht ist das der laufende Heimatverein aus dem Schnappschuss;
   * fehlt er, entfaellt der Link (die Maske braucht einen Verein im Pfad).
   */
  editClubId(entry: PlayerStatisticsEntry): number | null {
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
    this._search$.next(value);
  }

  onFilterChange(): void {
    this._dropInvisibleLeague();
    this.reload();
  }

  /** Mindestens ein Spiel, sonst verzerren Ein-Spiel-Quoten die Rangliste. */
  onMinGamesChange(value: string): void {
    const parsed = Number(value);
    this.minGames =
      Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
    this.reload();
  }

  resetFilters(): void {
    this.seasonIds = [];
    this.gameOperationId = null;
    this.leagueId = null;
    this.leagueClassId = null;
    this.teamId = null;
    this.clubFilterId = null;
    this.gender = null;
    this.minGames = 1;
    this.includeDeactivated = false;
    this.onlyCurrentMembers = true;
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
      this.minGames !== 1 ||
      this.includeDeactivated ||
      !this.onlyCurrentMembers ||
      this.search.trim() !== ''
    );
  }

  /** Jede Aenderung an Filter oder Sortierung beginnt wieder bei Seite 1. */
  reload(): void {
    this.page = 1;
    this._load$.next();
  }

  changePage(page: number): void {
    this.page = page;
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
