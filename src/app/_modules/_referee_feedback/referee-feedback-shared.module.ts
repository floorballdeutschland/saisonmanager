import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Components from './components';

/**
 * Der Fragebogen als eigenes Modul, damit beide Abgabewege ihn teilen: die
 * angemeldete Team-Übersicht und die öffentliche Seite mit Einmal-Link
 * (@floorball/public/referee-feedback).
 *
 * Der Transloco-Scope hängt bewusst hier und nicht am aufrufenden Modul: Die
 * Provider eines importierten Moduls landen im Injector des jeweiligen
 * Lazy-Moduls, damit lösen beide Abgabewege die Fragen-Keys auf. Läge der Scope
 * nur am angemeldeten Modul, zeigte die öffentliche Link-Seite die rohen Keys.
 */
@NgModule({
  imports: [CommonModule, FormsModule, UikitCommonModule],
  declarations: [Components.RefereeFeedbackFormComponent],
  exports: [Components.RefereeFeedbackFormComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'referee-feedback', alias: 'refereeFeedback' },
      multi: true,
    },
  ],
})
export class RefereeFeedbackSharedModule {}
