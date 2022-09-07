import { Pipe, PipeTransform } from '@angular/core';
import { Player } from '@floorball/types';

@Pipe({ name: 'sortPlayers' })
export class SortPlayersPipe implements PipeTransform {
  transform(allPlayer: Player[]): Player[] {
    return allPlayer.sort(
      (a, b) =>
        a.last_name.localeCompare(b.last_name) ||
        a.first_name.localeCompare(b.first_name)
    );
  }
}
