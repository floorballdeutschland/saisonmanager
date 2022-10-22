import { Pipe, PipeTransform } from '@angular/core';
import { PeriodTitles } from '@floorball/types';

@Pipe({ name: 'reversePeriods' })
export class ReversePeriodsPipe implements PipeTransform {
  transform(periods: PeriodTitles[], handleReverse: boolean): PeriodTitles[] {
    return handleReverse ? periods.reverse() : periods;
  }
}
