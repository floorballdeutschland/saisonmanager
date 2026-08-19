import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminSystemRoutingModule } from './admin-system-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminSystemRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.SystemIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/system', alias: 'system' },
      multi: true,
    },
  ],
})
export class AdminSystemModule {}
