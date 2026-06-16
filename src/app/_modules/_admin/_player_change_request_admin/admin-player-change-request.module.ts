import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminPlayerChangeRequestRoutingModule } from './admin-player-change-request-routing.module';
import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminPlayerChangeRequestRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.PlayerChangeRequestListComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/player-change-request',
        alias: 'playerChangeRequest',
      },
      multi: true,
    },
  ],
})
export class AdminPlayerChangeRequestModule {}
