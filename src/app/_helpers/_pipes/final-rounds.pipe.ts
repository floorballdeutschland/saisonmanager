import { Pipe, PipeTransform } from '@angular/core';
import { FinalRound, GameScheduleEntry } from '@floorball/types';

/**
 * Gruppiert Platzierungsspiele (Spiele ohne group_identifier) anhand
 * aufeinanderfolgender series_title zu Runden ("Halbfinale", "Finale", …).
 */
@Pipe({
  name: 'finalRounds',
  standalone: false,
})
export class FinalRoundsPipe implements PipeTransform {
  transform(matches: GameScheduleEntry[]): FinalRound[] {
    const finalMatches = matches.filter((m) => !m.group_identifier);
    const grouped = finalMatches.reduce<{
      result: FinalRound[];
      current: FinalRound | null;
    }>(
      (acc, game, index, array) => {
        const title = (game.series_title || '').trim();
        const prevTitle = (array[index - 1]?.series_title || '').trim();
        if (index === 0 || title === prevTitle) {
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

    return grouped.map((group) => ({
      ...group,
      round_title:
        group.matches.length > 1
          ? group.round_title.replace(/\d/g, '').trim()
          : group.round_title,
    }));
  }
}
