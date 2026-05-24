import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
})
export class AdminEmailLogModule {}
