import { Pipe, PipeTransform } from '@angular/core';
import { TeamWithPlayers } from '@floorball/types';

@Pipe({ name: 'clubPlayerLicense' })
export class ClubPlayerLicensePipe implements PipeTransform {
  transform(
    allTeams: TeamWithPlayers[],
    requestStatus: number,
    negate: boolean
  ): TeamWithPlayers[] {
    return allTeams.map((team) => {
      team.players = team.players.filter((player) => {
        return negate
          ? player.team_license.last_status_id == requestStatus
          : player.team_license.last_status_id != requestStatus;
      });

      return team;
    });
  }
}
