import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicOverviewRoutingModule } from './public-overview-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, PublicOverviewRoutingModule],
  declarations: [Views.OverviewComponent],
})
export class PublicOverviewModule {}
