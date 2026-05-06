import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicSecretaryRoutingModule } from './public-secretary-routing.module';
import * as Views from './views';

@NgModule({
  declarations: [Views.SpielSekretariatComponent],
  imports: [CommonModule, RouterModule, PublicSecretaryRoutingModule],
})
export class PublicSecretaryModule {}
