import { Pipe, PipeTransform } from '@angular/core';
import { StartingPlayer } from '@floorball/types';

@Pipe({ name: 'hasStartingPlayer' })
export class HasStartingPlayerPipe implements PipeTransform {
  transform(startingPlayers: StartingPlayer[]): boolean {
    return (
      startingPlayers.filter((player) => {
        return player.player_id;
      }).length > 0
    );
  }
}
