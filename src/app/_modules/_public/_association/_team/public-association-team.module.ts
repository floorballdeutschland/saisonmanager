import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicAssociationTeamRoutingModule } from './public-association-team-routing.module';

import * as Views from './_views';
import { UikitCommonModule } from '@floorball/uikit/common';

@NgModule({
  declarations: [Views.TeamComponent],
  imports: [
    CommonModule,
    RouterModule,
    PublicAssociationTeamRoutingModule,
    UikitCommonModule,
  ],
})
export class PublicAssociationTeamModule {}
