import { Pipe, PipeTransform } from '@angular/core';

export interface NormalizedMatchResult {
  result: string;
  extraTime: string | null;
}

@Pipe({
  name: 'normalizeMatchResult',
})
export class NormalizeMatchResultPipe implements PipeTransform {
  transform(value: string | undefined): NormalizedMatchResult {
    if (!value) {
      return { result: '', extraTime: '' };
    }
    return {
      result: value.replace('n.V', '').trim(),
      extraTime: value.includes('n.V') ? 'n.V' : null,
    };
  }
}
