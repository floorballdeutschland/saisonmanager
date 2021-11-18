import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicHomeRoutingModule } from './public-home-routing.module';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    PublicHomeRoutingModule,
    UikitPlayerModule,
    UikitTeamModule,
    UikitMatchesModule,
  ],
  declarations: [Views.HomeComponent, Views.StyleguideComponent],
})
export class PublicHomeModule {}
