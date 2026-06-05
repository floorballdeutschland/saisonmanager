import { Pipe, PipeTransform } from '@angular/core';
import { TeamWithPlayers } from '@floorball/types';

@Pipe({
  name: 'clubPlayerLicense',
  standalone: false,
})
export class ClubPlayerLicensePipe implements PipeTransform {
  transform(
    allTeams: TeamWithPlayers[],
    requestStatus: number,
    negate: boolean
  ): TeamWithPlayers[] {
    const teams: TeamWithPlayers[] = [];

    allTeams.forEach((team) => {
      const players = team.players.filter((player) => {
        return negate
          ? player.team_license.last_status.license_status_id != requestStatus
          : player.team_license.last_status.license_status_id == requestStatus;
      });

      if (players.length) {
        teams.push({
          ...team,
          players,
        });
      }
    });

    return teams;
  }
}
