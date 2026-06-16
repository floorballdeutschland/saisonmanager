import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminEmailLogRoutingModule } from './admin-email-log-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminEmailLogRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.EmailLogIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/email-log', alias: 'emailLog' },
      multi: true,
    },
  ],
})
export class AdminEmailLogModule {}
