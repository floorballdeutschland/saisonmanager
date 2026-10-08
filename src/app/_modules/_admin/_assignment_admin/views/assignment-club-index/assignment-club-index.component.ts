import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, of, switchMap, tap } from 'rxjs';
import {
  NotificationService,
  RefereeService,
  SeasonInfo,
  SettingsService,
} from '@floorball/core';
import {
  AssignmentClub,
  ClubAssignmentCoach,
  ClubAssignmentResult,
  RefereeAssignableGame,
} from '@floorball/types';

// Zeilenzustand im reduzierten Modus (Weg 3, #403): je Spiel entweder ein Verein,
// der das Gespann stellt, oder ein Freitext für Personen und Paare.
// Dazu, wo der Verband es eingeschaltet hat, ein Schiedsrichtercoach.
interface ClubRowState {
  clubId: number | null;
  freeText: string;
  coachId: number | null;
  saving: boolean;
}

// Eintrag im Coach-Auswahlfeld.
interface CoachOption {
  id: number;
  label: string;
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
  // Coaches je Spieltag: Die Auswahl hängt am Datum (Gültigkeit der
  // Qualifikation, Verfügbarkeit) und am Verband der Liga, beides ist für alle
  // Spiele eines Spieltags gleich. Geladen nur für aufgeklappte Spieltage mit
  // Coach-Ansetzung, Fehlschläge getrennt wie bei den Vereinen.
  coachesByGameDay: Record<string, ClubAssignmentCoach[]> = {};
  coachesFailed: Record<string, boolean> = {};
  private _coachesLoading = new Set<string>();
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
            coachId: game.coach_id ?? null,
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

  get hasCoachAssignment(): boolean {
    return this.games.some((game) => game.coach_assignable);
  }

  groupHasCoach(group: GameDayGroup): boolean {
    return group.games.some((game) => game.coach_assignable);
  }

  coachesFailedFor(game: RefereeAssignableGame): boolean {
    return !!this.coachesFailed[this._groupKey(game)];
  }

  retryCoaches(game: RefereeAssignableGame): void {
    this._loadCoaches(this._groupKey(game), game.id);
  }

  // Auswahl für die Zeile. Markiert, wer Verfügbarkeit gemeldet hat, und wer
  // einem der beiden Vereine angehört oder für sie ausgeschlossen ist. Ein
  // angesetzter Coach, der nicht mehr in der Liste steht (etwa weil seine
  // Qualifikation inzwischen abgelaufen ist), bleibt als Eintrag sichtbar,
  // sonst zeigte das Feld fälschlich „kein Coach“.
  coachOptions(game: RefereeAssignableGame): CoachOption[] {
    const coaches = this.coachesByGameDay[this._groupKey(game)] ?? [];
    const teamClubs = [game.home_team_club_id, game.guest_team_club_id].filter(
      (id): id is number => id != null
    );
    const options = coaches.map((coach) => {
      const hints: string[] = [];
      if (coach.available) {
        hints.push(
          this._transloco.translate('assignmentAdmin.club.coachAvailable')
        );
      }
      const conflict = teamClubs.some(
        (id) => coach.club_id === id || coach.excluded_club_ids.includes(id)
      );
      if (conflict) {
        hints.push(
          this._transloco.translate('assignmentAdmin.club.coachConflict')
        );
      }
      const name = `${coach.nachname}, ${coach.vorname}`;
      return {
        id: coach.id,
        label: hints.length ? `${name} (${hints.join(', ')})` : name,
      };
    });
    if (
      game.coach_id &&
      !options.some((option) => option.id === game.coach_id)
    ) {
      options.unshift({
        id: game.coach_id,
        label: game.coach_name ?? `#${game.coach_id}`,
      });
    }
    return options;
  }

  toggleGameDay(key: string): void {
    this._openStateTouched = true;
    this.openGameDays = this.openGameDays.includes(key)
      ? this.openGameDays.filter((item) => item !== key)
      : [...this.openGameDays, key];
    this._loadOptionsForOpenGroups();
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
    this._loadOptionsForOpenGroups();
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
    const clubDirty =
      !(nothingEntered && nothingStored) && this._clubDirty(game, state);
    // Ein Coach-Wechsel verschickt Mails. Deshalb nur, wenn er sich wirklich
    // geändert hat, und nicht bei jedem Speichern der Zeile.
    const coachDirty =
      !!game.coach_assignable && state.coachId !== (game.coach_id ?? null);
    if (!clubDirty && !coachDirty) return;

    state.saving = true;
    this._cdr.markForCheck();

    const payload = state.clubId
      ? { club_id: state.clubId }
      : { nominated_referee_string: state.freeText };

    // Erst Verein bzw. Freitext, dann der Coach: Die Ansetzungsmail an den
    // Coach nennt das Gespann, das muss also schon gespeichert sein.
    const club$: Observable<ClubAssignmentResult | null> = clubDirty
      ? this._refereeService.adminUpdateClubAssignment(game.id, payload)
      : of(null);
    club$
      .pipe(
        tap((result) => this._applyResult(game, result)),
        switchMap(
          (): Observable<ClubAssignmentResult | null> =>
            coachDirty
              ? this._refereeService.adminUpdateClubCoach(
                  game.id,
                  state.coachId
                )
              : of(null)
        ),
        tap((result) => this._applyResult(game, result))
      )
      .subscribe({
        next: () => {
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

  // Verein bzw. Freitext weichen vom gespeicherten Stand ab. Steht ein Verein,
  // gehört der Spielplantext ihm und das Freitextfeld ist leer.
  private _clubDirty(
    game: RefereeAssignableGame,
    state: ClubRowState
  ): boolean {
    if (state.clubId !== (game.assignment_club_id ?? null)) return true;
    if (state.clubId) return false;
    return state.freeText !== (game.nominated_referee_string ?? '');
  }

  private _applyResult(
    game: RefereeAssignableGame,
    result: ClubAssignmentResult | null
  ): void {
    if (!result) return;
    game.nominated_referee_string = result.nominated_referee_string;
    game.assignment_club_id = result.assignment_club_id ?? null;
    game.assignment_id = result.assignment_id ?? null;
    game.coach_id = result.coach_id ?? null;
    game.coach_name = result.coach_name ?? null;
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
        label:
          (nameCount.get(league.name) ?? 0) > 1 ? league.label : league.name,
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
    this._loadOptionsForOpenGroups();
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

  // Vereine und Coaches werden erst geholt, wenn ein Spieltag offen ist. Sonst löste ein
  // Wechsel auf „Alle Ligen“ eine Anfrage je Liga des Verbands aus.
  private _loadOptionsForOpenGroups(): void {
    const open = new Set(this.openGameDays);
    this.groups
      .filter((group) => open.has(group.key))
      .forEach((group) => {
        const game = group.games.find((item) => item.coach_assignable);
        if (game) this._loadCoaches(group.key, game.id);
      });
    new Set(
      this.groups
        .filter((group) => open.has(group.key))
        .flatMap((group) => group.games.map((game) => game.league_id))
        .filter((id): id is number => id != null)
    ).forEach((leagueId) => this._loadClubs(leagueId));
  }

  private _loadCoaches(key: string, gameId: number): void {
    if (this.coachesByGameDay[key] || this._coachesLoading.has(key)) return;

    this._coachesLoading.add(key);
    delete this.coachesFailed[key];
    this._refereeService.adminGetClubCoaches(gameId).subscribe({
      next: (coaches) => {
        this.coachesByGameDay[key] = coaches;
        this._coachesLoading.delete(key);
        this._cdr.markForCheck();
      },
      // Wie bei den Vereinen: kein leeres Ergebnis zwischenspeichern, sonst
      // würde der Spieltag nie wieder angefragt.
      error: () => {
        this._coachesLoading.delete(key);
        this.coachesFailed[key] = true;
        this._cdr.markForCheck();
      },
    });
  }

  private _loadClubs(leagueId: number): void {
    if (this.clubsByLeague[leagueId] || this._clubsLoading.has(leagueId))
      return;

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
