import { Pipe, PipeTransform } from '@angular/core';
import { PeriodTitles } from '@floorball/types';

@Pipe({
  name: 'onlyRunning',
  standalone: false,
})
export class PeriodFilterPipe implements PipeTransform {
  transform(allGameParts: PeriodTitles[]): PeriodTitles[] {
    return allGameParts.filter((g) => g.running);
  }
}
