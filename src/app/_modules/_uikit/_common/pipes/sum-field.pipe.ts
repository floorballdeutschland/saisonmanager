import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sumField',
  standalone: false,
})
export class SumFieldPipe implements PipeTransform {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(items: any[], field: string): number {
    return items.reduce((acc, item) => acc + (item[field] ?? 0), 0);
  }
}
