import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { PublicChecklistVetoRoutingModule } from './public-checklist-veto-routing.module';
import * as Views from './views';

/**
 * Einspruch des Ausrichtervereins gegen die Spieltagscheckliste, über den
 * Einmal-Link aus der Bestätigungsmail und ohne Anmeldung.
 */
@NgModule({
  declarations: [Views.ChecklistVetoComponent],
  imports: [
    CommonModule,
    RouterModule,
    UikitCommonModule,
    PublicChecklistVetoRoutingModule,
  ],
})
export class PublicChecklistVetoModule {}
