import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Views from './_views';
import { PublicAllMatchesOverviewRoutingModule } from './public-all-matches-overview-routing.module';

@NgModule({
  declarations: [Views.AllMatchesComponent],
  imports: [CommonModule, PublicAllMatchesOverviewRoutingModule],
})
export class PublicAllMatchesOverviewModule {}
