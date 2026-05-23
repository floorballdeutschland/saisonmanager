import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminAnalyticsRoutingModule } from './admin-analytics-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, AdminAnalyticsRoutingModule, UikitCommonModule],
  declarations: [Views.AnalyticsIndexComponent],
})
export class AdminAnalyticsModule {}
