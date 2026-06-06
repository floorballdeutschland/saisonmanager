import { Pipe, PipeTransform } from '@angular/core';
import { GameEvent } from '@floorball/types';

@Pipe({
  name: 'filterPeriodEvents',
  standalone: false,
})
export class FilterPeriodEventsPipe implements PipeTransform {
  transform(
    events: GameEvent[] | null | undefined,
    period: number
  ): GameEvent[] | null {
    if (!events) {
      return null;
    }

    return events.filter((event) => event.period === period);
  }
}
