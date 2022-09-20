import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicAssociationHostRoutingModule } from './public-association-host-routing.module';

import * as Views from './_views';
import { LeagueHostComponent } from './_views/league-host/league-host.component';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitLoadingSkeletonsModule } from '@floorball/uikit/skeletons';
import { AssociationIndexComponent } from './_views/association-index/association-index.component';

@NgModule({
  imports: [
    CommonModule,
    PublicAssociationHostRoutingModule,
    UikitCommonModule,
    UikitMatchesModule,
    UikitLoadingSkeletonsModule,
  ],
  declarations: [
    Views.AssociationHostComponent,
    LeagueHostComponent,
    AssociationIndexComponent,
  ],
})
export class PublicAssociationHostModule {}
