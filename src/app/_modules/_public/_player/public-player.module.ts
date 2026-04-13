import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicPlayerRoutingModule } from './public-player-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';
import * as Views from './_views';

@NgModule({
  declarations: [Views.PlayerStatsComponent],
  imports: [
    CommonModule,
    RouterModule,
    PublicPlayerRoutingModule,
    UikitCommonModule,
  ],
})
export class PublicPlayerModule {}
