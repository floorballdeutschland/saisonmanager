import { Pipe, PipeTransform } from '@angular/core';
import { AwardPlayer } from '@floorball/types';

@Pipe({
  name: 'completedAwards',
  standalone: false,
})
export class CompletedAwardsFilterPipe implements PipeTransform {
  transform(awards: AwardPlayer[]): AwardPlayer[] {
    return awards.filter((award) => award.player_id);
  }
}
