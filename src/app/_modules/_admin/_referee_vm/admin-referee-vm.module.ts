import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminRefereeVmRoutingModule } from './admin-referee-vm-routing.module';
import * as Views from './views';

@NgModule({
  imports: [CommonModule, AdminRefereeVmRoutingModule, UikitCommonModule],
  declarations: [Views.RefereeVmIndexComponent],
})
export class AdminRefereeVmModule {}
