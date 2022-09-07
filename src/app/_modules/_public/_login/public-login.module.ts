import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import * as Views from './views';
import { PublicLoginRoutingModule } from './public-login-routing.module';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [Views.LoginComponent, Views.LostPasswordComponent],
  imports: [CommonModule, PublicLoginRoutingModule, ReactiveFormsModule],
})
export class PublicLoginModule {}
