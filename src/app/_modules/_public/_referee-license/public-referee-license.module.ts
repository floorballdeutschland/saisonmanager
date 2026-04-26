import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PublicRefereeLicenseRoutingModule } from './public-referee-license-routing.module';
import * as Views from './views';

@NgModule({
  declarations: [Views.LizenzcheckComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PublicRefereeLicenseRoutingModule,
  ],
})
export class PublicRefereeLicenseModule {}
