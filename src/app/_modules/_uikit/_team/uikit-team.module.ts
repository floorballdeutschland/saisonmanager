import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CdkTableModule } from '@angular/cdk/table';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { TeamStartingPlayersComponent } from './components/organisms';

import * as Organisms from './components/organisms';
import { FormsModule } from '@angular/forms';
import { UikitMatchesModule } from '@floorball/uikit/matches';

@NgModule({
  imports: [
    CommonModule,
    CdkTableModule,
    RouterModule,
    FormsModule,
    UikitMatchesModule,
    UikitCommonModule,
    UikitPlayerModule,
  ],
  declarations: [
    Organisms.TeamRankingTableComponent,
    Organisms.TeamRankingTableOverlayComponent,
    Organisms.TeamLineupComponent,
    Organisms.TeamInfoComponent,
    Organisms.TeamHistoryComponent,
    Organisms.TeamSquadComponent,
    Organisms.TeamSquadHistoryComponent,
    Organisms.TeamSquadPlayerComponent,
    Organisms.TeamStartingPlayersComponent,
  ],
  exports: [
    Organisms.TeamRankingTableComponent,
    Organisms.TeamLineupComponent,
    Organisms.TeamInfoComponent,
    Organisms.TeamHistoryComponent,
    Organisms.TeamSquadComponent,
    Organisms.TeamSquadHistoryComponent,
    TeamStartingPlayersComponent,
  ],
})
export class UikitTeamModule {}
