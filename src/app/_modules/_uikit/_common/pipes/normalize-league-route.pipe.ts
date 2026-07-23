import { Pipe, PipeTransform } from '@angular/core';
import { League } from '@floorball/types';

/**
 * Slugify für Liga-Namen (Umlaute → ae/oe/ue, ß → ss, Sonderzeichen weg).
 * Bewusst als freie Funktion, damit auch Komponenten den Routen-Slug bauen
 * können, ohne die Pipe zu instanziieren.
 */
export function slugifyLeagueName(name: string): string {
  return name
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

/**
 * Baut das `:leagueId`-Routensegment im Format `${id}-${slug}`. Nur die
 * führende Zahl wird beim Auflösen ausgewertet (siehe LeagueService), der Slug
 * dient der Lesbarkeit/SEO.
 */
export function leagueRouteSegment(id: number, name: string): string {
  return `${id}-${slugifyLeagueName(name)}`;
}

@Pipe({
  name: 'normalizeLeagueRoute',
  standalone: false,
})
export class NormalizeLeagueRoutePipe implements PipeTransform {
  transform(league: League | undefined | null): string {
    if (!league) {
      return '';
    }

    return leagueRouteSegment(league.id, league.name);
  }
}
