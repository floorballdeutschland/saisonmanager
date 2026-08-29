import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeObservationSharedModule } from '@floorball/referee-observation';
import { AdminRefereeRoutingModule } from './admin-referee-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminRefereeRoutingModule,
    // Bringt die Detailansicht eines Beobachtungsbogens mit ihrem eigenen
    // Transloco-Scope mit, damit sie hier dieselben Texte auflöst wie im
    // Schiedsrichterportal.
    RefereeObservationSharedModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.RefereeIndexComponent,
    Views.RefereeEditComponent,
    Views.RefereeDetailComponent,
    Views.RefereeQualificationTypesComponent,
    Views.RefereeTagsComponent,
    Views.RefereeLicenseLevelsComponent,
    Views.RefereeSettingsComponent,
    Views.RefereeMergeComponent,
    Views.RefereeExclusionRequestsComponent,
    Views.RefereeChangeRequestsComponent,
    Views.RefereeAccountsComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/referee', alias: 'refereeAdmin' },
      multi: true,
    },
  ],
})
export class AdminRefereeModule {}
