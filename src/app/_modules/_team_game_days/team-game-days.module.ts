import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { TeamGameDaysRoutingModule } from './team-game-days-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TeamGameDaysRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.TeamGameDaysComponent],
})
export class TeamGameDaysModule {}
