import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';

/**
 * Auffangseite für Adressen, zu denen es keine Route gibt.
 *
 * Vorher warf jeder unbekannte Pfad ab drei Segmenten `NG04002` in den
 * globalen ErrorHandler: Der Besucher sah eine leere Seite, und Sentry sammelte
 * die Aufrufe alter Lesezeichen und verbogener Links (#455). Pfade mit einem
 * oder zwei Segmenten kommen hier nicht an, die nimmt der Spielbetriebs-Host
 * als Verband bzw. Liga ab.
 *
 * nginx liefert für jeden Pfad die index.html mit Status 200 aus. Ohne das
 * `noindex` wäre die Seite ein Soft-404, den Suchmaschinen aufnehmen.
 */
@Component({
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class NotFoundComponent implements OnInit, OnDestroy {
  constructor(private _meta: Meta) {}

  ngOnInit(): void {
    this._meta.updateTag({ name: 'robots', content: 'noindex' });
  }

  ngOnDestroy(): void {
    // Sonst bliebe das noindex für den Rest der Sitzung stehen, wenn der
    // Besucher über den Link zur Startseite weiterklickt.
    this._meta.removeTag("name='robots'");
  }
}
