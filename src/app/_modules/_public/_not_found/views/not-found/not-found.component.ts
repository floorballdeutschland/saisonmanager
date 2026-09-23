import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Auffangseite für Adressen, zu denen es keine Route gibt.
 *
 * Vorher warf jeder unbekannte Pfad mit mehr als einem Segment `NG04002` in den
 * globalen ErrorHandler: Der Besucher sah eine leere Seite, und Sentry sammelte
 * die Aufrufe alter Lesezeichen und verbogener Links (#455).
 */
@Component({
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class NotFoundComponent {}
