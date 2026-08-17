import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminContactRoutingModule } from './admin-contact-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminContactRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.ContactIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/contact', alias: 'contactAdmin' },
      multi: true,
    },
  ],
})
export class AdminContactModule {}
