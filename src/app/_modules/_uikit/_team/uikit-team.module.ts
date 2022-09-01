import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CdkTableModule } from '@angular/cdk/table';
import { RouterModule } from '@angular/router';

import * as Organisms from './components/organisms';
import { TeamSquadComponent } from './components/organisms';

@NgModule({
  imports: [CommonModule, CdkTableModule, RouterModule],
  declarations: [
    Organisms.TeamRankingTableComponent,
    Organisms.TeamLineupComponent,
    Organisms.TeamInfoComponent,
    Organisms.TeamHistoryComponent,
    Organisms.TeamSquadComponent,
    Organisms.TeamSquadHistoryComponent,
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
