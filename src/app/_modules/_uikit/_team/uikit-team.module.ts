import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CdkTableModule } from '@angular/cdk/table';
import { RouterModule } from '@angular/router';

import * as Organisms from './components/organisms';
import { TeamSquadPlayerComponent } from './components/organisms/team-squad-player/team-squad-player.component';
import { TeamLineupPlayerPipe } from '../../../_helpers/_pipes/team-lineup-player.pipe';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [CommonModule, CdkTableModule, RouterModule, FormsModule],
  declarations: [
    Organisms.TeamRankingTableComponent,
    Organisms.TeamLineupComponent,
    Organisms.TeamInfoComponent,
    Organisms.TeamHistoryComponent,
    Organisms.TeamSquadComponent,
    Organisms.TeamSquadHistoryComponent,
    TeamSquadPlayerComponent,
    TeamLineupPlayerPipe,
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
