import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import * as Views from './views';
import { PublicLoginRoutingModule } from './public-login-routing.module';
import { ReactiveFormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';

@NgModule({
  declarations: [
    Views.ForgotUsernameComponent,
    Views.LoginComponent,
    Views.LostPasswordComponent,
  ],
  imports: [
    CommonModule,
    PublicLoginRoutingModule,
    ReactiveFormsModule,
    UikitCommonModule,
  ],
})
export class PublicLoginModule {}
