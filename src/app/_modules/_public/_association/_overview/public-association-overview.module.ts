import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicAssociationOverviewRoutingModule } from './public-association-overview-routing.module';

import * as Views from './_views';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitCommonModule } from '@floorball/uikit/common';

@NgModule({
  imports: [
    CommonModule,
    PublicAssociationOverviewRoutingModule,
    UikitMatchesModule,
    UikitTeamModule,
    UikitPlayerModule,
    UikitCommonModule,
  ],
  declarations: [Views.OverviewComponent],
})
export class PublicAssociationOverviewModule {}
