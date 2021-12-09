import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationScorerRoutingModule } from './public-association-scorer-routing.module';

import * as Views from './_views';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitLoadingSkeletonsModule } from '@floorball/uikit/skeletons';
import { UikitCommonModule } from '@floorball/uikit/common';
@NgModule({
  declarations: [Views.ScorerComponent],
  imports: [
    CommonModule,
    PublicAssociationScorerRoutingModule,
    UikitPlayerModule,
    UikitLoadingSkeletonsModule,
    UikitCommonModule,
  ],
})
export class PublicAssociationScorerModule {}
