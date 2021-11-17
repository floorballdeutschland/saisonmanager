import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
// TODO Path of modules
import { UikitPlayerModule } from '../../_uikit/_player';
import { PublicHomeRoutingModule } from './public-home-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, PublicHomeRoutingModule, UikitPlayerModule],
  declarations: [Views.HomeComponent, Views.StyleguideComponent],
})
export class PublicHomeModule {}
