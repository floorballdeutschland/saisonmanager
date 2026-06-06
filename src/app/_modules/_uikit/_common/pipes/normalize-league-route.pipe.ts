import { Pipe, PipeTransform } from '@angular/core';
import { League } from '@floorball/types';

@Pipe({
  name: 'normalizeLeagueRoute',
  standalone: false,
})
export class NormalizeLeagueRoutePipe implements PipeTransform {
  transform(league: League | undefined | null): string {
    if (!league) {
      return '';
    }

    return `${league.id}-${this.slugify(league.name)}`;
  }

  slugify(route: string) {
    return route
      .toLowerCase()
      .trim()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
