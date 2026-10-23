import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  FieldGeometry,
  FieldMarkings,
  fieldGeometry,
  fieldMarkings,
} from 'src/app/_helpers/_utils/field-geometry';

/**
 * Bande, Mittellinie, Mittelpunkt, Bullypunkte, Torräume und Tore in Metern,
 * als `<g>` innerhalb eines SVG. Gemeinsame Zeichnung von Schussbild und
 * Freischlagbild der Statistik (fe#589), damit beide dasselbe Feld zeigen.
 */
@Component({
  // Attribut auf einem SVG-`<g>`: Ein eigenes Element (`<fb-…>`) wäre im SVG
  // ein unbekanntes Element, dessen Inhalt der Browser nicht zeichnet.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'g[fbRinkMarkings]',
  templateUrl: './rink-markings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RinkMarkingsComponent {
  @Input() field: FieldGeometry = fieldGeometry(null);
  @Input() markings: FieldMarkings = fieldMarkings(this.field);
}
