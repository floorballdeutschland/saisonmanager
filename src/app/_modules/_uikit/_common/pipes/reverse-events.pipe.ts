import { Pipe, PipeTransform } from '@angular/core';
import { GameEvent } from '@floorball/types';

@Pipe({
  name: 'reverseEvents',
  standalone: false,
})
export class ReverseEventsPipe implements PipeTransform {
  transform(
    events: GameEvent[] | null | undefined,
    newestFirst = false
  ): GameEvent[] | null {
    if (!events) {
      return null;
    }

    return newestFirst ? events.reverse() : events;
  }
}
