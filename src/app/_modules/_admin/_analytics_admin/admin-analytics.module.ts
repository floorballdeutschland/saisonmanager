import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminAnalyticsRoutingModule } from './admin-analytics-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, AdminAnalyticsRoutingModule, UikitCommonModule],
  declarations: [Views.AnalyticsIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/analytics', alias: 'analytics' },
      multi: true,
    },
  ],
})
export class AdminAnalyticsModule {}
