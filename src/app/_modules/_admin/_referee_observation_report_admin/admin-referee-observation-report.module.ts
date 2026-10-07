import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeObservationSharedModule } from '@floorball/referee-observation';
import { AdminRefereeObservationReportRoutingModule } from './admin-referee-observation-report-routing.module';

import * as Views from './views';

/**
 * Übersicht aller Beobachtungsbögen der Schiedsrichtercoaches (Feedback #73).
 * Die Detailansicht eines Bogens kommt aus dem geteilten Modul, samt dessen
 * Transloco-Scope.
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminRefereeObservationReportRoutingModule,
    UikitCommonModule,
    RefereeObservationSharedModule,
  ],
  declarations: [Views.RefereeObservationReportIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/referee-observation-report',
        alias: 'refereeObservationReport',
      },
      multi: true,
    },
  ],
})
export class AdminRefereeObservationReportModule {}
