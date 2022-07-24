import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AdminLeagueRoutingModule } from './admin-league-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    AdminLeagueRoutingModule,
    UikitPlayerModule,
    UikitTeamModule,
    UikitMatchesModule,
    UikitCommonModule,
  ],
  declarations: [Views.LeagueIndexComponent],
})
export class AdminLeagueModule {}
