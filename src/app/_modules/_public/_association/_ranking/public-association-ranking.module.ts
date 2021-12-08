import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationRankingRoutingModule } from './public-association-ranking-routing.module';

import * as Views from './_views';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitLoadingSkeletonsModule } from '@floorball/uikit/skeletons';
@NgModule({
  declarations: [Views.RankingComponent],
  imports: [
    CommonModule,
    PublicAssociationRankingRoutingModule,
    UikitTeamModule,
    UikitMatchesModule,
    UikitCommonModule,
    UikitLoadingSkeletonsModule,
  ],
})
export class PublicAssociationRankingModule {}
