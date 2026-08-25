import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

/**
 * Wie die Angular-DatePipe, wirft aber nicht.
 *
 * Die DatePipe beendet die Change Detection mit NG02100, sobald sie einen Wert
 * bekommt, den sie nicht in ein Datum umwandeln kann. In JSONB-Feldern wie
 * `Player#licenses[].history[].created_at` stehen aber Altdaten-Einträge mit
 * abweichenden oder fehlenden Zeitstempeln, und ein einziger davon nimmt sonst
 * die komplette Maske mit. Solche Werte werden hier unformatiert durchgereicht.
 */
@Pipe({
  name: 'safeDate',
  standalone: false,
})
export class SafeDatePipe implements PipeTransform {
  constructor(private _datePipe: DatePipe) {}

  transform(
    value: string | number | Date | null | undefined,
    format = 'dd.MM.yyyy'
  ): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    try {
      return this._datePipe.transform(value, format);
    } catch {
      return String(value);
    }
  }
}
