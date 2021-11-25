import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationTeamRoutingModule } from './public-association-team-routing.module';

import * as Views from './_views';

@NgModule({
  declarations: [Views.TeamComponent],
  imports: [CommonModule, PublicAssociationTeamRoutingModule],
})
export class PublicAssociationTeamModule {}
