import { Pipe, PipeTransform } from '@angular/core';
import { Game, PeriodTitles } from '@floorball/types';

@Pipe({
  name: 'timelineFilter',
  standalone: false,
})
export class GameTimelineFilterPipe implements PipeTransform {
  transform(allPeriods: PeriodTitles[], game: Game): PeriodTitles[] {
    let active;
    const filteredPeriods = allPeriods.filter(
      (period) => period.optional === game.current_period_title?.optional
    );

    return filteredPeriods.filter((period, index) => {
      const statusIndex = filteredPeriods.findIndex(
        (item) => item.status_id === game.ingame_status
      );

      if (statusIndex < 0) {
        active = 1;
      } else if (statusIndex === index) {
        active = 0;
      } else if (statusIndex < index) {
        active = 1;
      } else {
        active = -1;
      }

      return !game.ended || active <= 0;
    });
  }
}
