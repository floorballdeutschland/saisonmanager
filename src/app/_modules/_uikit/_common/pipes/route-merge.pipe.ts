import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'routeMerge',
  standalone: false,
})
export class RouteMergePipe implements PipeTransform {
  transform(value: string[], baseRoute: string[]): string[] {
    return [...baseRoute, ...value];
  }
}
