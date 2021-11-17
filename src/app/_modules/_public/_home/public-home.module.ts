import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicHomeRoutingModule } from './public-home-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, PublicHomeRoutingModule],
  declarations: [Views.HomeComponent],
})
export class PublicHomeModule {}
