import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Ein Reiter innerhalb von `<fb-tabs>`. Der Inhalt steht in einem
 * `ng-template` und wird erst gerendert, wenn der Reiter aktiv ist; Abrufe
 * in Kindkomponenten laufen also erst beim ersten Öffnen.
 *
 * Ein Reiter, den eine Rolle nicht sehen darf, wird mit `@if` um das
 * `ng-template` weggelassen, nicht ausgeblendet.
 */
@Directive({
  selector: 'ng-template[fbTab]',
  standalone: false,
})
export class TabDirective {
  /** Kennung des Reiters, steht so im Query-Parameter. */
  @Input({ alias: 'fbTab', required: true })
  id!: string;

  @Input()
  fbTabLabel = '';

  /** Markiert den Reiter, etwa wenn ein Pflichtfeld darin fehlt. */
  @Input()
  fbTabInvalid = false;

  /** Zahl oder kurzer Text hinter der Beschriftung, z. B. offene Vorgänge. */
  @Input()
  fbTabBadge?: string | number | null;

  constructor(readonly template: TemplateRef<unknown>) {}
}
