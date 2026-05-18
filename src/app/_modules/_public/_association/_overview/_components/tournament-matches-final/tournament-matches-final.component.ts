import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { GameScheduleEntry } from '@floorball/types';
import { FinalRound } from '../../../../../../_models/game-schedule-entry.interface';
import { Observable, tap } from 'rxjs';

export interface BracketRound {
  title: string;
  games: GameScheduleEntry[];
}

@Component({
  selector: 'fb-tournament-matches-final',
  templateUrl: './tournament-matches-final.component.html',
})
export class TournamentMatchesFinalComponent implements OnInit {
  @Input() matches$?: Observable<GameScheduleEntry[]>;

  viewMode: 'bracket' | 'list' = 'bracket';
  bracketRounds: BracketRound[] = [];
  consolationGames: GameScheduleEntry[] = [];
  groupedMatches: FinalRound[] = [];
  loaded = false;

  constructor(private _cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.matches$) {
      this.matches$
        .pipe(
          tap((matches) => {
            this._buildBracket(matches);
            this._buildGroupedList(matches);
            this.loaded = true;
            this._cdr.markForCheck();
          })
        )
        .subscribe();
    }
  }

  private _buildBracket(matches: GameScheduleEntry[]): void {
    const koGames = matches.filter((m) => !m.group_identifier);
    if (koGames.length === 0) {
      this.bracketRounds = [];
      this.consolationGames = [];
      return;
    }

    const gameMap = new Map<number, GameScheduleEntry>(
      koGames.map((m) => [m.game_id, m])
    );

    const isConsolation = (g: GameScheduleEntry) =>
      g.home_team_filling_rule === 'game_loser' ||
      g.guest_team_filling_rule === 'game_loser';

    this.consolationGames = koGames.filter(isConsolation);
    const mainGames = koGames.filter((g) => !isConsolation(g));

    if (mainGames.length === 0) {
      this.bracketRounds = [];
      return;
    }

    const depthCache = new Map<number, number>();
    const getDepth = (id: number, stack = new Set<number>()): number => {
      if (depthCache.has(id)) return depthCache.get(id)!;
      if (stack.has(id)) return 0;
      stack.add(id);
      const g = gameMap.get(id);
      if (!g) return 0;
      let max = -1;
      const check = (rule?: string | null, param?: number | null) => {
        if (rule?.startsWith('game_winner') && param) {
          max = Math.max(max, getDepth(param, new Set(stack)));
        }
      };
      check(g.home_team_filling_rule, g.home_team_filling_parameter);
      check(g.guest_team_filling_rule, g.guest_team_filling_parameter);
      const depth = max + 1;
      depthCache.set(id, depth);
      return depth;
    };

    mainGames.forEach((g) => getDepth(g.game_id));

    const maxDepth = Math.max(
      ...mainGames.map((g) => depthCache.get(g.game_id) ?? 0)
    );

    const byDepth = new Map<number, GameScheduleEntry[]>();
    for (let i = 0; i <= maxDepth; i++) byDepth.set(i, []);
    mainGames.forEach((g) => {
      const d = depthCache.get(g.game_id) ?? 0;
      byDepth.get(d)!.push(g);
    });

    const rounds: GameScheduleEntry[][] = [];
    for (let i = 0; i <= maxDepth; i++) rounds.push(byDepth.get(i)!);

    for (let i = maxDepth; i > 0; i--) {
      const ordered: GameScheduleEntry[] = [];
      const remaining = new Set(rounds[i - 1]);
      for (const game of rounds[i]) {
        const homeId = game.home_team_filling_rule?.startsWith('game_')
          ? game.home_team_filling_parameter
          : null;
        const guestId = game.guest_team_filling_rule?.startsWith('game_')
          ? game.guest_team_filling_parameter
          : null;
        const homeSrc = homeId ? gameMap.get(homeId) : null;
        const guestSrc = guestId ? gameMap.get(guestId) : null;
        if (homeSrc && remaining.has(homeSrc)) {
          ordered.push(homeSrc);
          remaining.delete(homeSrc);
        }
        if (guestSrc && remaining.has(guestSrc)) {
          ordered.push(guestSrc);
          remaining.delete(guestSrc);
        }
      }
      ordered.push(...remaining);
      rounds[i - 1] = ordered;
    }

    this.bracketRounds = rounds.map((games, idx) => ({
      title: this._roundTitle(idx, maxDepth, games),
      games,
    }));
  }

  private _buildGroupedList(matches: GameScheduleEntry[]): void {
    const finalMatches = matches.filter((m) => !m.group_identifier);
    const grouped = finalMatches.reduce<{
      result: FinalRound[];
      current: FinalRound | null;
    }>(
      (acc, game, index, array) => {
        const title = (game.series_title || '').trim();
        if (index === 0 || title === array[index - 1].series_title) {
          if (!acc.current) acc.current = { round_title: title, matches: [] };
          acc.current.matches.push(game);
        } else {
          if (acc.current) acc.result.push(acc.current);
          acc.current = { round_title: title, matches: [game] };
        }
        if (index === array.length - 1 && acc.current) {
          acc.result.push(acc.current);
        }
        return acc;
      },
      { result: [], current: null }
    ).result;

    this.groupedMatches = grouped.map((group) => ({
      ...group,
      round_title:
        group.matches.length > 1
          ? group.round_title.replace(/\d/g, '').trim()
          : group.round_title,
    }));
  }

  private _roundTitle(
    idx: number,
    maxDepth: number,
    games: GameScheduleEntry[]
  ): string {
    const titles = [
      ...new Set(games.map((g) => g.series_title).filter(Boolean)),
    ];
    if (titles.length === 1) return titles[0]!;
    const fromFinal = maxDepth - idx;
    if (fromFinal === 0) return 'Finale';
    if (fromFinal === 1) return 'Halbfinale';
    if (fromFinal === 2) return 'Viertelfinale';
    if (fromFinal === 3) return 'Achtelfinale';
    return `Runde ${idx + 1}`;
  }

  teamName(game: GameScheduleEntry, side: 'home' | 'guest'): string {
    if (side === 'home') {
      return game.home_team_name || game.home_team_filling_title || '–';
    }
    return game.guest_team_name || game.guest_team_filling_title || '–';
  }

  hasTeam(game: GameScheduleEntry, side: 'home' | 'guest'): boolean {
    return side === 'home' ? !!game.home_team_name : !!game.guest_team_name;
  }

  score(game: GameScheduleEntry, side: 'home' | 'guest'): number | null {
    if (!game.result) return null;
    return side === 'home' ? game.result.home_goals : game.result.guest_goals;
  }

  isWinner(game: GameScheduleEntry, side: 'home' | 'guest'): boolean {
    if (!game.result || !game.ended) return false;
    const homeWins = game.result.home_goals > game.result.guest_goals;
    return side === 'home' ? homeWins : !homeWins;
  }

  connectorPairs(roundIdx: number): GameScheduleEntry[] {
    return this.bracketRounds[roundIdx + 1]?.games ?? [];
  }
}
