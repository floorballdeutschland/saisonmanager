import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminPlayerRoutingModule } from './admin-player-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminPlayerRoutingModule,
    UikitPlayerModule,
    UikitTeamModule,
    UikitMatchesModule,
    UikitCommonModule,
  ],
  declarations: [Views.PlayerIndexComponent, Views.PlayerEditComponent],
})
export class AdminPlayerModule {}
