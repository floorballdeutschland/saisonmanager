import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicAssociationOverviewRoutingModule } from './public-association-overview-routing.module';

import * as Views from './_views';

@NgModule({
  imports: [CommonModule, PublicAssociationOverviewRoutingModule],
  declarations: [Views.OverviewComponent],
})
export class PublicAssociationOverviewModule {}
