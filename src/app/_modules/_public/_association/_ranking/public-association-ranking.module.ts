import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationRankingRoutingModule } from './public-association-ranking-routing.module';

import * as Views from './_views';
@NgModule({
  declarations: [Views.RankingComponent],
  imports: [CommonModule, PublicAssociationRankingRoutingModule],
})
export class PublicAssociationRankingModule {}
