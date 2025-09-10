import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationTeamRoutingModule } from './public-association-team-routing.module';

import * as Views from './_views';
import { UikitCommonModule } from '@floorball/uikit/common';

@NgModule({
  declarations: [Views.TeamComponent],
  imports: [
    CommonModule,
    PublicAssociationTeamRoutingModule,
    UikitCommonModule,
  ],
})
export class PublicAssociationTeamModule {}
