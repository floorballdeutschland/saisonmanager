import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminRefereeFeedbackReportRoutingModule } from './admin-referee-feedback-report-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminRefereeFeedbackReportRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.RefereeFeedbackReportIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/referee-feedback-report',
        alias: 'refereeFeedbackReport',
      },
      multi: true,
    },
  ],
})
export class AdminRefereeFeedbackReportModule {}
