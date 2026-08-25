import { Pipe, PipeTransform } from '@angular/core';
import { StartingPlayer } from '@floorball/types';

@Pipe({
  name: 'hasStartingPlayer',
  standalone: false,
})
export class HasStartingPlayerPipe implements PipeTransform {
  transform(startingPlayers: StartingPlayer[] | null | undefined): boolean {
    if (!Array.isArray(startingPlayers)) {
      return false;
    }

    return startingPlayers.some((player) => !!player?.player_id);
  }
}
