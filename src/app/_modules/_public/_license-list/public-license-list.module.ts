import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicLicenseListRoutingModule } from './public-license-list-routing.module';
import * as Views from './views';

@NgModule({
  declarations: [Views.LizenzlisteComponent],
  imports: [CommonModule, RouterModule, PublicLicenseListRoutingModule],
})
export class PublicLicenseListModule {}
