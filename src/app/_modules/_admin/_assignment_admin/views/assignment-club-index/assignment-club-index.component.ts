import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslocoService } from '@jsverse/transloco';
import {
  NotificationService,
  RefereeService,
  SeasonInfo,
  SettingsService,
} from '@floorball/core';
import { AssignmentClub, RefereeAssignableGame } from '@floorball/types';

// Zeilenzustand im reduzierten Modus (Weg 3, #403): je Spiel entweder ein Verein,
// der das Gespann stellt, oder ein Freitext für Personen und Paare.
interface ClubRowState {
  clubId: number | null;
  freeText: string;
  saving: boolean;
}

interface LeagueOption {
  id: number;
  name: string;
}

// Anzeige-Einheit ist der Spieltag, nicht das einzelne Spiel: die RSK arbeitet
// eine Liga Spieltag für Spieltag ab.
interface GameDayGroup {
  key: string;
  number: number | null;
  date: string;
  arena: string;
  arenaCity: string;
  games: RefereeAssignableGame[];
}

@Component({
  selector: 'fb-assignment-club-index',
  templateUrl: './assignment-club-index.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AssignmentClubIndexComponent implements OnInit {
  games: RefereeAssignableGame[] = [];
  seasons: SeasonInfo[] = [];
  loading = true;

  seasonId = '';
  dateFrom = '';
  dateTo = '';

  // Ligen aus der geladenen Spieleliste. Ein eigener Endpunkt wäre eine zweite
  // Wahrheit: hier soll genau das zur Auswahl stehen, was auch Spiele hat.
  leagues: LeagueOption[] = [];
  // null bedeutet „alle Ligen“.
  selectedLeagueId: number | null = null;
  groups: GameDayGroup[] = [];
  openGameDays: string[] = [];

  rowStates: Record<number, ClubRowState> = {};
  // Vereine je Liga: die Auswahl sind die Vereine der Mannschaften dieser Liga,
  // also pro Liga verschieden. Geladen wird nur, was gerade angezeigt wird.
  clubsByLeague: Record<number, AssignmentClub[]> = {};
  private _clubsLoading = new Set<number>();

  constructor(
    private _refereeService: RefereeService,
    private _settingsService: SettingsService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._settingsService.getSeasons().subscribe({
      next: (data) => {
        this.seasons = data.seasons;
        this.seasonId = data.current_season_id.toString();
        this._cdr.markForCheck();
        this.load();
      },
      error: () => this.load(),
    });
  }

  load(): void {
    this.loading = true;
    this._cdr.markForCheck();

    const params: Record<string, string> = {};
    if (this.seasonId) params['season_id'] = this.seasonId;
    if (this.dateFrom) params['date_from'] = this.dateFrom;
    if (this.dateTo) params['date_to'] = this.dateTo;

    this._refereeService.adminGetAssignableGames(params).subscribe({
      next: (games) => {
        this.games = games;
        this.rowStates = {};
        games.forEach((game) => {
          this.rowStates[game.id] = {
            clubId: game.assignment_club_id ?? null,
            // Steht ein Verein, gehört der Text ihm – dann bleibt das
            // Freitextfeld leer, sonst stünde der Vereinsname doppelt.
            freeText: game.assignment_club_id
              ? ''
              : (game.nominated_referee_string ?? ''),
            saving: false,
          };
        });
        this._buildLeagues();
        this._buildGroups();
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      },
    });
  }

  onLeagueChange(): void {
    // Die Spieltage der neuen Liga starten aufgeklappt, wie beim Wechsel auf
    // eine andere Liga im Spielplan.
    this.openGameDays = [];
    this._buildGroups();
    this._cdr.markForCheck();
  }

  clubsFor(game: RefereeAssignableGame): AssignmentClub[] {
    return game.league_id ? (this.clubsByLeague[game.league_id] ?? []) : [];
  }

  toggleGameDay(key: string): void {
    this.openGameDays = this.openGameDays.includes(key)
      ? this.openGameDays.filter((item) => item !== key)
      : [...this.openGameDays, key];
  }

  get allExpanded(): boolean {
    return (
      this.groups.length > 0 && this.openGameDays.length === this.groups.length
    );
  }

  toggleAllGameDays(): void {
    this.openGameDays = this.allExpanded
      ? []
      : this.groups.map((group) => group.key);
  }

  // Zähler über *alle* Spiele des Spieltags, nicht über eine gefilterte Auswahl:
  // sonst meldet der Kopf „0 von 1“, wo „7 von 8“ richtig wäre (vgl. fe#210).
  // Gesperrte Spiele zählen nicht mit, die pflegt die Ansetzer*in personenscharf.
  assignableCount(group: GameDayGroup): number {
    return group.games.filter((game) => !game.locked).length;
  }

  assignedCount(group: GameDayGroup): number {
    return group.games.filter(
      (game) =>
        !game.locked &&
        (game.assignment_club_id != null ||
          !!game.nominated_referee_string?.trim())
    ).length;
  }

  // Verein und Freitext schließen einander aus: der Server speichert entweder
  // die Verknüpfung oder den Text. Die Maske spiegelt das, damit nicht beides
  // ausgefüllt aussieht und beim Speichern eines davon still verschwindet.
  onClubChange(game: RefereeAssignableGame): void {
    const state = this.rowStates[game.id];
    if (state?.clubId) state.freeText = '';
  }

  onFreeTextChange(game: RefereeAssignableGame): void {
    const state = this.rowStates[game.id];
    if (state?.freeText) state.clubId = null;
  }

  save(game: RefereeAssignableGame): void {
    const state = this.rowStates[game.id];
    if (!state || state.saving) return;

    state.saving = true;
    this._cdr.markForCheck();

    const payload = state.clubId
      ? { club_id: state.clubId }
      : { nominated_referee_string: state.freeText };

    this._refereeService.adminUpdateClubAssignment(game.id, payload).subscribe({
      next: (result) => {
        game.nominated_referee_string = result.nominated_referee_string;
        game.assignment_club_id = result.assignment_club_id ?? null;
        game.assignment_id = result.assignment_id ?? null;
        state.saving = false;
        this._notificationService.success(
          this._transloco.translate('assignmentAdmin.club.saved'),
          { autoClose: true, keepAfterRouteChange: false }
        );
        this._cdr.markForCheck();
      },
      error: () => {
        state.saving = false;
        this._cdr.markForCheck();
      },
    });
  }

  private _buildLeagues(): void {
    const byId = new Map<number, LeagueOption>();
    this.games.forEach((game) => {
      if (game.league_id == null || byId.has(game.league_id)) return;
      byId.set(game.league_id, {
        id: game.league_id,
        name: game.league ?? '',
      });
    });
    this.leagues = [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'de')
    );

    // Die zuletzt gewählte Liga überlebt einen Filterwechsel, solange sie noch
    // Spiele hat; sonst die erste. Ohne Vorauswahl stünde die Ansicht wieder
    // ligaübergreifend da, und genau das war der Rückschritt.
    const stillThere = this.leagues.some(
      (league) => league.id === this.selectedLeagueId
    );
    if (!stillThere) {
      this.selectedLeagueId = this.leagues.length ? this.leagues[0].id : null;
      this.openGameDays = [];
    }
  }

  private _buildGroups(): void {
    const visible =
      this.selectedLeagueId == null
        ? this.games
        : this.games.filter((game) => game.league_id === this.selectedLeagueId);

    // Die Reihenfolge kommt aus der API (Liga, Spieltagsnummer, Datum, Anwurf);
    // die Map hält sie fest.
    const byGameDay = new Map<string, GameDayGroup>();
    visible.forEach((game) => {
      const key = this._groupKey(game);
      let group = byGameDay.get(key);
      if (!group) {
        group = {
          key,
          number: game.game_day_number ?? null,
          date: game.date,
          arena: game.arena ?? '',
          arenaCity: game.arena_city ?? '',
          games: [],
        };
        byGameDay.set(key, group);
      }
      group.games.push(game);
    });

    this.groups = [...byGameDay.values()];
    this._syncOpenGameDays();
    this._loadClubsForVisibleLeagues(visible);
  }

  // Der Spieltag ist die Gruppe. Fehlt die Kennung (ältere API), fällt die
  // Gruppierung auf Liga und Datum zurück – gröber, aber nie eine Liste, in der
  // alles zu einem Klumpen zusammenfällt.
  private _groupKey(game: RefereeAssignableGame): string {
    return game.game_day_id != null
      ? `gd-${game.game_day_id}`
      : `d-${game.league_id}-${game.date}`;
  }

  private _syncOpenGameDays(): void {
    const currentKeys = this.groups.map((group) => group.key);
    if (this.openGameDays.length === 0) {
      this.openGameDays = currentKeys;
      return;
    }
    const known = new Set(this.openGameDays);
    const current = new Set(currentKeys);
    this.openGameDays = [
      ...this.openGameDays.filter((key) => current.has(key)),
      ...currentKeys.filter((key) => !known.has(key)),
    ];
  }

  private _loadClubsForVisibleLeagues(visible: RefereeAssignableGame[]): void {
    new Set(
      visible
        .map((game) => game.league_id)
        .filter((id): id is number => id != null)
    ).forEach((leagueId) => this._loadClubs(leagueId));
  }

  private _loadClubs(leagueId: number): void {
    if (this.clubsByLeague[leagueId] || this._clubsLoading.has(leagueId)) return;

    this._clubsLoading.add(leagueId);
    this._refereeService
      .adminGetLeagueAssignmentClubs(leagueId)
      .pipe(catchError(() => of([] as AssignmentClub[])))
      .subscribe({
        next: (clubs) => {
          this.clubsByLeague[leagueId] = clubs;
          this._clubsLoading.delete(leagueId);
          this._cdr.markForCheck();
        },
      });
  }
}
