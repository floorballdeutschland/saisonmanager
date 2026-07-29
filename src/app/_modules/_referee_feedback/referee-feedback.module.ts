import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeFeedbackRoutingModule } from './referee-feedback-routing.module';
import { RefereeFeedbackSharedModule } from './referee-feedback-shared.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RefereeFeedbackRoutingModule,
    RefereeFeedbackSharedModule,
    UikitCommonModule,
  ],
  declarations: [Views.RefereeFeedbackComponent],
})
export class RefereeFeedbackModule {}
