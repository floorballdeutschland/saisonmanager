import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminMatchReportRoutingModule } from './admin-match-report-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminMatchReportRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.MatchReportIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/match-report', alias: 'matchReportAdmin' },
      multi: true,
    },
  ],
})
export class AdminMatchReportModule {}
