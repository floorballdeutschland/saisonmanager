import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

/**
 * Ersatz für die DatePipe an den JSONB-Zeitstempeln der Spielermaske.
 *
 * Die DatePipe wirft NG02100, sobald sie einen Wert bekommt, den sie nicht in
 * ein Datum umwandeln kann. Aus einer Pipe heraus beendet das die Change
 * Detection, ein einziger solcher Wert nimmt also die komplette Maske mit
 * (Sentry SAISONMANAGER-3B, 39 Ereignisse in `licenses[].history[].created_at`).
 * Welcher Wert genau, ist offen: Der Blick in die Produktionsdaten stand nicht
 * zur Verfügung. Fehlende Werte sind es nicht, die gibt die DatePipe selbst als
 * `null` zurück.
 *
 * Kein Ersatz für jedes `| date`: Die Voreinstellung ist `dd.MM.yyyy`, und
 * `timezone` sowie `locale` werden bewusst nicht durchgereicht, weil hier nur
 * Datumsangaben aus dem Bestand gerendert werden.
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
