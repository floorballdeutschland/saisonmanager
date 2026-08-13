import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { PublicLiveRoutingModule } from './public-live-routing.module';
import * as Views from './views';

@NgModule({
  declarations: [Views.LiveComponent],
  imports: [
    CommonModule,
    RouterModule,
    UikitCommonModule,
    PublicLiveRoutingModule,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'live', alias: 'live' },
      multi: true,
    },
  ],
})
export class PublicLiveModule {}
