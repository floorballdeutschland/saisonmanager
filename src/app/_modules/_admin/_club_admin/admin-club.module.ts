import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminClubRoutingModule } from './admin-club-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminClubRoutingModule,
    UikitPlayerModule,
    UikitTeamModule,
    UikitMatchesModule,
    UikitCommonModule,
  ],
  declarations: [Views.ClubIndexComponent, Views.ClubEditComponent],
})
export class AdminClubModule {}
