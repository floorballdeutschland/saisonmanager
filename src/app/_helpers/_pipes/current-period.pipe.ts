import { Pipe, PipeTransform } from '@angular/core';
import { Game, PeriodTitles } from '@floorball/types';

@Pipe({ name: 'currentPeriod' })
export class CurrentPeriodPipe implements PipeTransform {
  transform(game: Game): PeriodTitles | undefined {
    return game.period_titles.find(
      (part) => part.status_id === game.ingame_status
    );
  }
}
