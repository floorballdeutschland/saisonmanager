import { Pipe, PipeTransform } from '@angular/core';
import { LeagueClass } from '@floorball/types';

@Pipe({ name: 'leagueClass' })
export class LeagueClassPipe implements PipeTransform {
  transform(
    allClasses: LeagueClass[],
    type: 'fd' | 'ok' | 'not_ok'
  ): LeagueClass[] {
    return allClasses.filter((lc) => {
      switch (type) {
        case 'fd':
          return lc.isBuli === true;
        case 'ok':
          return lc.isBuli !== true && lc.isPermitted;
        case 'not_ok':
          return lc.isBuli !== true && !lc.isPermitted;
        default:
          return true;
      }
    });
  }
}
