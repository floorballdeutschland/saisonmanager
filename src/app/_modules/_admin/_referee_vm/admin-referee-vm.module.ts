import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminRefereeVmRoutingModule } from './admin-referee-vm-routing.module';
import * as Views from './views';

@NgModule({
  imports: [CommonModule, AdminRefereeVmRoutingModule, UikitCommonModule],
  declarations: [Views.RefereeVmIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/referee-vm', alias: 'refereeVm' },
      multi: true,
    },
  ],
})
export class AdminRefereeVmModule {}
