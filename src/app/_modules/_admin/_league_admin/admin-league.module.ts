import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminLeagueRoutingModule } from './admin-league-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { DragDropModule } from '@angular/cdk/drag-drop';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminLeagueRoutingModule,
    UikitPlayerModule,
    UikitTeamModule,
    UikitMatchesModule,
    UikitCommonModule,
    DragDropModule,
  ],
  declarations: [Views.LeagueIndexComponent, Views.LeagueEditComponent],
})
export class AdminLeagueModule {}
