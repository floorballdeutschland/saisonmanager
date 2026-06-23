import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeFeedbackRoutingModule } from './referee-feedback-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RefereeFeedbackRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.RefereeFeedbackComponent],
})
export class RefereeFeedbackModule {}
