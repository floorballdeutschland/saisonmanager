import { Pipe, PipeTransform } from '@angular/core';
import { GameScheduleEntry } from '@floorball/types';

@Pipe({ name: 'groupIdentifier' })
export class GroupIdentifierFilterPipe implements PipeTransform {
  transform(
    matches: GameScheduleEntry[],
    groupIdentifier: string
  ): GameScheduleEntry[] {
    return matches.filter(
      (match) => match.group_identifier === groupIdentifier
    );
  }
}
