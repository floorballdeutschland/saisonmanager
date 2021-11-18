import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
// TODO Path of modules
import { UikitPlayerModule } from '../../_uikit/_player';
import { PublicHomeRoutingModule } from './public-home-routing.module';

import * as Views from './views';
import { UikitTeamModule } from '../../_uikit/_team';

@NgModule({
  imports: [
    CommonModule,
    PublicHomeRoutingModule,
    UikitPlayerModule,
    UikitTeamModule,
  ],
  declarations: [Views.HomeComponent, Views.StyleguideComponent],
})
export class PublicHomeModule {}
