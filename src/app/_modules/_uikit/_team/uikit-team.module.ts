import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CdkTableModule } from '@angular/cdk/table';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Organisms from './components/organisms';
import { TeamSquadPlayerComponent } from './components/organisms/team-squad-player/team-squad-player.component';
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
  ],
  declarations: [
    Organisms.TeamRankingTableComponent,
    Organisms.TeamRankingTableOverlayComponent,
    Organisms.TeamLineupComponent,
    Organisms.TeamInfoComponent,
    Organisms.TeamHistoryComponent,
    Organisms.TeamSquadComponent,
    Organisms.TeamSquadHistoryComponent,
    TeamSquadPlayerComponent,
  ],
  exports: [
    Organisms.TeamRankingTableComponent,
    Organisms.TeamLineupComponent,
    Organisms.TeamInfoComponent,
    Organisms.TeamHistoryComponent,
    Organisms.TeamSquadComponent,
    Organisms.TeamSquadHistoryComponent,
  ],
})
export class UikitTeamModule {}
