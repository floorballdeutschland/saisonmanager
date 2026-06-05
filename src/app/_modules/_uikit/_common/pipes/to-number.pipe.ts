import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'toNumber',
  standalone: false,
})
export class ToNumberPipe implements PipeTransform {
  transform(value: string | undefined): number {
    return value ? parseInt(value) : 0;
  }
}
