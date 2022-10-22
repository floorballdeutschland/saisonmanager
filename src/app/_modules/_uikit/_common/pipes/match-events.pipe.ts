import { Pipe, PipeTransform } from '@angular/core';
import { GameEvent } from '@floorball/types';

@Pipe({
  name: 'matchEvents',
})
export class MatchEventsPipe implements PipeTransform {
  transform(
    events: GameEvent[] | null | undefined,
    period: number,
    newestFirst = false
  ): GameEvent[] | null {
    if (!events) {
      return null;
    }

    return (newestFirst ? events.reverse() : events).filter(
      (event) => event.period === period
    );
  }
}
