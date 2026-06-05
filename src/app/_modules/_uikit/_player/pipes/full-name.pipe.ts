// full-name.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { AwardPlayer, GamePlayerEntry, StartingPlayer } from '@floorball/types';

@Pipe({
  name: 'fullName',
  standalone: false,
})
export class FullNamePipe implements PipeTransform {
  transform(player: GamePlayerEntry | StartingPlayer | AwardPlayer): string {
    return `${player.player_firstname} ${player.player_name}`;
  }
}
