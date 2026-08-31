import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminPlayerStatsModule } from '@floorball/admin/player-stats';
import { AdminPlayerVmRoutingModule } from './admin-player-vm-routing.module';
import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminPlayerVmRoutingModule,
    UikitCommonModule,
    AdminPlayerStatsModule,
  ],
  declarations: [Views.PlayerVmIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/player-vm', alias: 'playerVm' },
      multi: true,
    },
  ],
})
export class AdminPlayerVmModule {}
