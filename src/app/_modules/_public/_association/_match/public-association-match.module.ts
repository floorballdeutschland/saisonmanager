import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationMatchRoutingModule } from './public-association-match-routing.module';

import * as Views from './_views';

@NgModule({
  declarations: [Views.MatchComponent],
  imports: [CommonModule, PublicAssociationMatchRoutingModule],
})
export class PublicAssociationMatchModule {}
