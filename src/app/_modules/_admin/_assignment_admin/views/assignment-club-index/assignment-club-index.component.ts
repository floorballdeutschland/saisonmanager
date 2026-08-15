import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
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
  // Beschriftung im Auswahlfeld: der Liganame, bei gleichnamigen Ligen um den
  // Spielbetrieb ergänzt.
  label: string;
}

// Anzeige-Einheit ist der Spieltag, nicht das einzelne Spiel: die RSK arbeitet
// eine Liga Spieltag für Spieltag ab.
interface GameDayGroup {
  key: string;
  number: number | null;
  date: string;
  league: string;
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

  // Ligen aus der geladenen Spieleliste, also aus den Spielen der Saison im
  // gewählten Zeitraum, die noch nicht angepfiffen sind. Ein eigener Endpunkt
  // wäre eine zweite Wahrheit: zur Auswahl soll genau stehen, was auch Spiele hat.
  leagues: LeagueOption[] = [];
  // null steht für „alle Ligen“ und zugleich für den Zustand vor dem ersten
  // Laden sowie für „keine Liga hat Spiele“.
  selectedLeagueId: number | null = null;
  groups: GameDayGroup[] = [];
  openGameDays: string[] = [];

  rowStates: Record<number, ClubRowState> = {};
  // Vereine je Liga: die Auswahl sind die Vereine der Mannschaften dieser Liga,
  // also pro Liga verschieden. Einmal je Liga geladen, nicht je Spiel; deshalb
  // der Wächter in _loadClubs. Der Speicher wird nicht geleert, angefragt wird
  // aber nur für aufgeklappte Spieltage.
  clubsByLeague: Record<number, AssignmentClub[]> = {};
  // Ligen, deren Vereinsliste nicht geladen werden konnte. Ohne diese Trennung
  // wäre ein Fehlschlag von „diese Liga hat keine Vereine“ nicht zu unterscheiden.
  clubsFailed: Record<number, boolean> = {};
  private _clubsLoading = new Set<number>();
  // Trennt „noch keine Entscheidung“ von „bewusst alles zugeklappt“. Beides
  // wäre sonst eine leere openGameDays-Liste, und jeder Neuaufbau risse die
  // zugeklappte Ansicht wieder auf.
  private _openStateTouched = false;
  // Die Spieltage des letzten Aufbaus, um neu hinzugekommene zu erkennen.
  private _knownGroupKeys = new Set<string>();

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
    // Eine frisch gewählte Liga startet mit dem Standardzustand: aufgeklappt,
    // wie im Admin-Spielplan (schedule-index). „Alle Ligen“ startet zugeklappt,
    // sonst stünden die Spieltage sämtlicher Ligen gleichzeitig offen.
    this._openStateTouched = false;
    this._buildGroups();
    this._cdr.markForCheck();
  }

  clubsFor(game: RefereeAssignableGame): AssignmentClub[] {
    return game.league_id ? (this.clubsByLeague[game.league_id] ?? []) : [];
  }

  clubsFailedFor(game: RefereeAssignableGame): boolean {
    return game.league_id ? !!this.clubsFailed[game.league_id] : false;
  }

  retryClubs(game: RefereeAssignableGame): void {
    if (game.league_id) this._loadClubs(game.league_id);
  }

  toggleGameDay(key: string): void {
    this._openStateTouched = true;
    this.openGameDays = this.openGameDays.includes(key)
      ? this.openGameDays.filter((item) => item !== key)
      : [...this.openGameDays, key];
    this._loadClubsForOpenGroups();
  }

  get allExpanded(): boolean {
    return (
      this.groups.length > 0 && this.openGameDays.length === this.groups.length
    );
  }

  toggleAllGameDays(): void {
    this._openStateTouched = true;
    this.openGameDays = this.allExpanded
      ? []
      : this.groups.map((group) => group.key);
    this._loadClubsForOpenGroups();
  }

  // Zähler über die Spiele des Spieltags, die in dieser Liste stehen, also die
  // noch nicht angepfiffenen. Gesperrte zählen nicht mit: sie sind entweder für
  // die Personenebene markiert oder bereits mit einem Gespann besetzt, in
  // beiden Fällen nicht die Aufgabe der RSK.
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

    // Leeres Feld auf leerem Spiel ist keine Änderung. Ohne diese Bremse würde
    // ein Speichern auf der noch nicht befüllten Zeile eine leere Ansetzung
    // schreiben und den Erfolgs-Toast zeigen; steht dagegen schon etwas im
    // Spiel, bleibt das Leeren die legitime Art, einen Eintrag zurückzunehmen.
    const nothingEntered = !state.clubId && !state.freeText.trim();
    const nothingStored =
      game.assignment_club_id == null && !game.nominated_referee_string?.trim();
    if (nothingEntered && nothingStored) return;

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
    const nameCount = new Map<string, number>();
    this.games.forEach((game) => {
      if (game.league_id == null || byId.has(game.league_id)) return;
      const name = game.league || `#${game.league_id}`;
      nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
      byId.set(game.league_id, {
        id: game.league_id,
        name,
        // Erst nach dem Durchlauf entscheidbar, siehe unten.
        label: game.game_operation ? `${name} (${game.game_operation})` : name,
      });
    });
    // Ligen verschiedener Verbände heißen oft gleich, und ein RSK-Scope kann
    // mehrere Spielbetriebe umfassen. Nur dann trägt der Verband etwas bei,
    // sonst bläht er jede Zeile auf.
    this.leagues = [...byId.values()]
      .map((league) => ({
        ...league,
        label: (nameCount.get(league.name) ?? 0) > 1 ? league.label : league.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));

    // Die zuletzt gewählte Liga überlebt einen Filterwechsel, solange sie noch
    // Spiele hat; sonst die erste. Ohne Vorauswahl stünde die Ansicht wieder
    // ligaübergreifend da, und genau das war der Rückschritt.
    const stillThere = this.leagues.some(
      (league) => league.id === this.selectedLeagueId
    );
    if (!stillThere) {
      this.selectedLeagueId = this.leagues.length ? this.leagues[0].id : null;
      this._openStateTouched = false;
    }
  }

  private _buildGroups(): void {
    const visible =
      this.selectedLeagueId == null
        ? this.games
        : this.games.filter((game) => game.league_id === this.selectedLeagueId);

    // Die Reihenfolge kommt aus der API (Liga, Spieltag, Datum, Anwurf,
    // Spielnummer); die Map hält sie fest. Das trägt, weil dieselbe Rolle über
    // Ansicht und Sortierung entscheidet: die Komponente wird nur im
    // reduzierten Modus gerendert, und genau dort sortiert die API so.
    const byGameDay = new Map<string, GameDayGroup>();
    visible.forEach((game) => {
      const key = this._groupKey(game);
      let group = byGameDay.get(key);
      if (!group) {
        group = {
          key,
          number: game.game_day_number ?? null,
          date: game.date,
          league: game.league ?? '',
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
    this._loadClubsForOpenGroups();
  }

  // Der Spieltag ist die Gruppe. Fehlt die Kennung, weil das Frontend vor der
  // API live geht, fällt die Gruppierung auf Liga, Datum und Halle zurück. Das
  // trennt zwei Spieltage derselben Liga am selben Tag nur, wenn sie in
  // verschiedenen Hallen laufen; die Kopfzeile bliebe sonst falsch.
  private _groupKey(game: RefereeAssignableGame): string {
    return game.game_day_id != null
      ? `gd-${game.game_day_id}`
      : `d-${game.league_id}-${game.date}-${game.arena ?? ''}`;
  }

  private _syncOpenGameDays(): void {
    const currentKeys = this.groups.map((group) => group.key);
    const allLeagues = this.selectedLeagueId == null;

    if (!this._openStateTouched) {
      this.openGameDays = allLeagues ? [] : currentKeys;
      this._knownGroupKeys = new Set(currentKeys);
      return;
    }

    const current = new Set(currentKeys);
    this.openGameDays = [
      ...this.openGameDays.filter((key) => current.has(key)),
      // Neu aufgetauchte Spieltage aufklappen, damit sie nach einem Reload
      // nicht übersehen werden. Gemessen wird das an den zuletzt gezeigten
      // Spieltagen, nicht an den offenen: sonst gälte nach „alle zuklappen“
      // jeder Spieltag wieder als neu. Über alle Ligen hinweg wäre es zu viel.
      ...(allLeagues
        ? []
        : currentKeys.filter((key) => !this._knownGroupKeys.has(key))),
    ];
    this._knownGroupKeys = current;
  }

  // Vereine werden erst geholt, wenn ein Spieltag offen ist. Sonst löste ein
  // Wechsel auf „Alle Ligen“ eine Anfrage je Liga des Verbands aus.
  private _loadClubsForOpenGroups(): void {
    const open = new Set(this.openGameDays);
    new Set(
      this.groups
        .filter((group) => open.has(group.key))
        .flatMap((group) => group.games.map((game) => game.league_id))
        .filter((id): id is number => id != null)
    ).forEach((leagueId) => this._loadClubs(leagueId));
  }

  private _loadClubs(leagueId: number): void {
    if (this.clubsByLeague[leagueId] || this._clubsLoading.has(leagueId)) return;

    this._clubsLoading.add(leagueId);
    delete this.clubsFailed[leagueId];
    this._refereeService.adminGetLeagueAssignmentClubs(leagueId).subscribe({
      next: (clubs) => {
        this.clubsByLeague[leagueId] = clubs;
        this._clubsLoading.delete(leagueId);
        this._cdr.markForCheck();
      },
      // Kein Eintrag in clubsByLeague: ein leeres Array wäre für den Wächter
      // oben ein gültiges Ergebnis und die Liga würde nie wieder angefragt.
      // Die Zeile zeigt stattdessen einen Hinweis statt einer leeren Auswahl,
      // denn ein leeres Dropdown sieht aus wie „diese Liga hat keine Vereine“.
      error: () => {
        this._clubsLoading.delete(leagueId);
        this.clubsFailed[leagueId] = true;
        this._cdr.markForCheck();
      },
    });
  }
}
