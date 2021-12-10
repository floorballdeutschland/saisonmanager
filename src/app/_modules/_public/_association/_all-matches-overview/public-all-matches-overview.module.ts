import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Views from './_views';
import { PublicAllMatchesOverviewRoutingModule } from './public-all-matches-overview-routing.module';
import { UikitMatchesModule } from '@floorball/uikit/matches';

@NgModule({
  declarations: [Views.AllMatchesComponent],
  imports: [
    CommonModule,
    PublicAllMatchesOverviewRoutingModule,
    UikitMatchesModule,
  ],
})
export class PublicAllMatchesOverviewModule {}
