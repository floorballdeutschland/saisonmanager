import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationScorerRoutingModule } from './public-association-scorer-routing.module';

import * as Views from './_views';
@NgModule({
  declarations: [Views.ScorerComponent],
  imports: [CommonModule, PublicAssociationScorerRoutingModule],
})
export class PublicAssociationScorerModule {}
