import { Pipe, PipeTransform } from '@angular/core';
import { GamePlayerEntry } from '@floorball/types';

@Pipe({ name: 'sortTrikotNumber' })
export class SortTrikotnumbersPipe implements PipeTransform {
  transform(allPlayer: GamePlayerEntry[]): GamePlayerEntry[] {
    if (!allPlayer) {
      return [];
    }

    return allPlayer.sort((a, b) => a.trikot_number - b.trikot_number);
  }
}
