import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RankingComponent } from './_views/ranking/ranking.component';
import { PublicAssociationRankingRoutingModule } from './public-association-ranking-routing.module';

@NgModule({
  declarations: [RankingComponent],
  imports: [CommonModule, PublicAssociationRankingRoutingModule],
})
export class PublicAssociationRankingModule {}
