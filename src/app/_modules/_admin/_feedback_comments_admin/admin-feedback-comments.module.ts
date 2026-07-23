import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminFeedbackCommentsRoutingModule } from './admin-feedback-comments-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminFeedbackCommentsRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.FeedbackCommentsIndexComponent,
    Views.FeedbackThemesComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/feedback-comments',
        alias: 'feedbackComments',
      },
      multi: true,
    },
  ],
})
export class AdminFeedbackCommentsModule {}
