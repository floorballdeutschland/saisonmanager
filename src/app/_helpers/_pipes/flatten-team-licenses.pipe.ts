import { Pipe, PipeTransform } from '@angular/core';
import {
  ClubMembership,
  PlayerLicense,
  TeamWithPlayers,
} from '@floorball/types';

@Pipe({ name: 'flattenTeamLicenses' })
export class FlattenTeamLicensesPipe implements PipeTransform {
  transform(allClasses: TeamWithPlayers[]): PlayerLicense[] {
    const items: PlayerLicense[] = [];

    allClasses.forEach((team) => {
      team.players.forEach((player) => {
        items.push(player.team_license);
      });
    });

    return items;
  }
}
