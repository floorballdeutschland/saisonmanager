import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationMatchRoutingModule } from './public-association-match-routing.module';

import * as Views from './_views';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitPlayerModule } from '@floorball/uikit/player';

@NgModule({
  declarations: [Views.MatchComponent],
  imports: [
    CommonModule,
    PublicAssociationMatchRoutingModule,
    UikitCommonModule,
    UikitMatchesModule,
    UikitTeamModule,
    UikitPlayerModule,
  ],
})
export class PublicAssociationMatchModule {}
