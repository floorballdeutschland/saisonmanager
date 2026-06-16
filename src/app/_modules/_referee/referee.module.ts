import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeRoutingModule } from './referee-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, FormsModule, RefereeRoutingModule, UikitCommonModule],
  declarations: [
    Views.RefereeProfileComponent,
    Views.RefereeCardComponent,
    Views.RefereeHistoryComponent,
    Views.RefereeBlockedDatesComponent,
    Views.RefereeGameDaysComponent,
    Views.RefereeOnlineTestIndexComponent,
    Views.RefereeOnlineTestDetailComponent,
    Views.RefereeOnlineTestExamComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'referee', alias: 'refereeSelf' },
      multi: true,
    },
  ],
})
export class RefereeModule {}
