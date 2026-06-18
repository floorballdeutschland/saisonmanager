import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminAvailabilityRoutingModule } from './admin-availability-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminAvailabilityRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.AvailabilityIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/availability', alias: 'availabilityAdmin' },
      multi: true,
    },
  ],
})
export class AdminAvailabilityModule {}
