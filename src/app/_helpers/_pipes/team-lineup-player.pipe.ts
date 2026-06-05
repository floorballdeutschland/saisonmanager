import { Pipe, PipeTransform } from '@angular/core';
import { GamePlayerEntry, PlayerWithLicense } from '@floorball/types';

// License::APPROVED in der API – nur erteilte Lizenzen dürfen aufgestellt werden
const LICENSE_STATUS_APPROVED = 1;

@Pipe({
  name: 'teamLineupPlayer',
  standalone: false,
})
export class TeamLineupPlayerPipe implements PipeTransform {
  transform(
    allPlayers: PlayerWithLicense[],
    lineupPlayers: GamePlayerEntry[],
    status: 'all' | 'selected' | 'not-selected'
  ): {
    player: PlayerWithLicense;
    gamePlayerEntry: GamePlayerEntry | null;
  }[] {
    const items: {
      player: PlayerWithLicense;
      gamePlayerEntry: GamePlayerEntry | null;
    }[] = [];

    const isInLineup = (playerId: number) =>
      !!lineupPlayers?.find((lp) => lp.player_id === playerId);

    const eligiblePlayers = allPlayers.filter(
      (p) =>
        p.current_status?.license_status_id === LICENSE_STATUS_APPROVED ||
        isInLineup(p.id)
    );

    eligiblePlayers.map((player) => {
      let lineupPlayer = null;
      switch (status) {
        case 'not-selected':
          if (
            !lineupPlayers?.find(
              (lineupPlayer) => lineupPlayer.player_id === player.id
            )
          ) {
            items.push({
              player,
              gamePlayerEntry: lineupPlayer,
            });
          }
          break;
        case 'selected':
          lineupPlayer = lineupPlayers?.find(
            (lineupPlayer) => lineupPlayer.player_id === player.id
          );
          if (lineupPlayer) {
            items.push({
              player,
              gamePlayerEntry: lineupPlayer,
            });
          }
          break;
        default:
          lineupPlayer = lineupPlayers?.find(
            (lineupPlayer) => lineupPlayer.player_id === player.id
          );
          items.push({
            player,
            gamePlayerEntry: lineupPlayer ?? null,
          });
          break;
      }
    });

    return items.sort(
      (a, b) =>
        a.player.last_name.localeCompare(b.player.last_name) ||
        a.player.first_name.localeCompare(b.player.first_name)
    );
  }
}
