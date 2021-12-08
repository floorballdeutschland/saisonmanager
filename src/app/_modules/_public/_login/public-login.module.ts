import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import * as Views from './views';
import { PublicLoginRoutingModule } from './public-login-routing.module';

@NgModule({
  declarations: [Views.LoginComponent],
  imports: [CommonModule, PublicLoginRoutingModule],
})
export class PublicLoginModule {}
