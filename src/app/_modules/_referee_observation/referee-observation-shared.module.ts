import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Components from './components';

/**
 * Die Detailansicht eines Beobachtungsbogens als eigenes Modul, damit sie drei
 * Stellen teilen können: das Schiedsrichterportal (Coach- und Empfängersicht)
 * und die Schiedsrichterverwaltung am Profil.
 *
 * Der Transloco-Scope hängt bewusst hier und nicht am aufrufenden Modul. Die
 * Provider eines importierten Moduls landen im Injector des jeweiligen
 * Lazy-Moduls; läge der Scope nur am Portal-Modul, zeigte die Verwaltung die
 * rohen Keys.
 */
@NgModule({
  imports: [CommonModule, RouterModule, UikitCommonModule],
  declarations: [Components.ObservationDetailComponent],
  exports: [Components.ObservationDetailComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'referee-observation', alias: 'refereeObservation' },
      multi: true,
    },
  ],
})
export class RefereeObservationSharedModule {}
