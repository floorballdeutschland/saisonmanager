import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicAssociationHostRoutingModule } from './public-association-host-routing.module';

import * as Views from './_views';

@NgModule({
  imports: [CommonModule, PublicAssociationHostRoutingModule],
  declarations: [Views.AssociationHostComponent],
})
export class PublicAssociationHostModule {}
