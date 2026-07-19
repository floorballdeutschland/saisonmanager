import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { PublicEmailConfirmationRoutingModule } from './public-email-confirmation-routing.module';
import * as Views from './views';

@NgModule({
  declarations: [Views.EmailConfirmationComponent],
  imports: [
    CommonModule,
    RouterModule,
    TranslocoModule,
    PublicEmailConfirmationRoutingModule,
  ],
})
export class PublicEmailConfirmationModule {}
