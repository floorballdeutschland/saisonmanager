import { Pipe, PipeTransform } from '@angular/core';

export interface NormalizedMatchResult {
  result: string;
  extraTime: string | null;
}

@Pipe({
  name: 'normalizeMatchResult',
})
export class NormalizeMatchResultPipe implements PipeTransform {
  transform(value: string): NormalizedMatchResult {
    console.log(value, value.replace('n.V', ''));
    return {
      result: value.replace('n.V', '').trim(),
      extraTime: value.includes('n.V') ? 'n.V' : null,
    };
  }
}
