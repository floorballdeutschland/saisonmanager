import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicAssociationOverviewRoutingModule } from './public-association-overview-routing.module';

import * as Views from './_views';
import * as Components from './_components';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitLoadingSkeletonsModule } from '@floorball/uikit/skeletons';
import { TournamentMatchesComponent } from './_components/tournament-matches/tournament-matches.component';
import { TournamentMatchesGroupComponent } from './_components/tournament-matches-group/tournament-matches-group.component';
@NgModule({
  imports: [
    CommonModule,
    PublicAssociationOverviewRoutingModule,
    UikitMatchesModule,
    UikitTeamModule,
    UikitPlayerModule,
    UikitCommonModule,
    UikitLoadingSkeletonsModule,
  ],
  declarations: [
    Views.OverviewComponent,
    Components.MatchesWithRoundsComponent,
    TournamentMatchesComponent,
    TournamentMatchesGroupComponent,
  ],
})
export class PublicAssociationOverviewModule {}
