import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminEmailTemplateRoutingModule } from './admin-email-template-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminEmailTemplateRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.EmailTemplateIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/email-template', alias: 'emailTemplateAdmin' },
      multi: true,
    },
  ],
})
export class AdminEmailTemplateModule {}
