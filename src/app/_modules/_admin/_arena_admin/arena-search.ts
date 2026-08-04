import { Arena } from '@floorball/types';

/**
 * Sucht in Name und Stadt eines Spielorts nach `term` (bereits kleingeschrieben
 * und getrimmt erwartet).
 *
 * Beide Felder werden ausdrücklich gegen `null` abgesichert: Die Spalten
 * `arenas.name` und `arenas.city` sind in der Datenbank nicht NOT NULL, und der
 * Altbestand aus dem Import 2010–2014 enthält Einträge ohne Namen bzw. ohne
 * Stadt. Ein einziger solcher Eintrag brachte die Filter-Getter beim Tippen zum
 * Absturz (`name.toLowerCase()` auf `null`), womit die Suche wirkungslos aussah,
 * weil die Ansicht gar nicht mehr aktualisiert wurde.
 */
export function arenaMatchesTerm(arena: Arena, term: string): boolean {
  if (!term) return true;

  return (
    (arena.name ?? '').toLowerCase().includes(term) ||
    (arena.city ?? '').toLowerCase().includes(term)
  );
}
