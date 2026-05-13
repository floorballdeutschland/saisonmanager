import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeRoutingModule } from './referee-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, FormsModule, RefereeRoutingModule, UikitCommonModule],
  declarations: [
    Views.RefereeProfileComponent,
    Views.RefereeBlockedDatesComponent,
    Views.RefereeOnlineTestIndexComponent,
    Views.RefereeOnlineTestDetailComponent,
    Views.RefereeOnlineTestExamComponent,
  ],
})
export class RefereeModule {}
