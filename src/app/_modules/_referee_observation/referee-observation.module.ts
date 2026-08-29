import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';

import { RefereeObservationRoutingModule } from './referee-observation-routing.module';
import { RefereeObservationSharedModule } from './referee-observation-shared.module';
import * as Views from './views';

/**
 * Beobachtungsbögen des Schiedsrichtercoaches im Schiedsrichterportal.
 *
 * Bewusst ein eigenes Modul und nicht Teil von @floorball/referee: Dessen
 * Lazy-Einstieg hängt an `menu_item_referee_profile`, und den bekommt nur ein
 * REINES Schiedsrichterkonto (Early-Return in User#permissions_items). Ein
 * Coach, der zugleich Schiedsrichterkommission oder Ansetzer ist, käme an seine
 * eigenen Beobachtungen sonst nicht heran.
 *
 * Den Transloco-Scope stellt das geteilte Modul, damit ihn die
 * Schiedsrichterverwaltung mit derselben Detailansicht mitbekommt.
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RefereeObservationRoutingModule,
    RefereeObservationSharedModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.ObservationCoachIndexComponent,
    Views.ObservationFormComponent,
    Views.ObservationReceivedComponent,
  ],
})
export class RefereeObservationModule {}
