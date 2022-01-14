import { Pipe, PipeTransform } from '@angular/core';
import { GameResult } from '@floorball/types';

export interface NormalizedMatchResult {
  result: string;
  extraTime: string | null;
}

@Pipe({
  name: 'normalizeMatchResult',
})
export class NormalizeMatchResultPipe implements PipeTransform {
  transform(
    result: GameResult | undefined,
    options: { detailed?: boolean } = {}
  ): NormalizedMatchResult {
    if (!result) {
      return { result: '-:-', extraTime: '' };
    }
    return {
      result: `${result.home_goals}:${result.guest_goals}`,
      extraTime: options.detailed ? result.postfix.long : result.postfix.short,
    };
  }
}
