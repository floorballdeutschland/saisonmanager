import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
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
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/settings', alias: 'settings' },
      multi: true,
    },
  ],
})
export class AdminSettingsModule {}
