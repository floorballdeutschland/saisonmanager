import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminSettingsRoutingModule } from './admin-settings-routing.module';
import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminSettingsRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.SeasonAdminComponent],
})
export class AdminSettingsModule {}
