import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminRefereeRoutingModule } from './admin-referee-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminRefereeRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.RefereeIndexComponent,
    Views.RefereeEditComponent,
    Views.RefereeDetailComponent,
    Views.RefereeQualificationTypesComponent,
  ],
})
export class AdminRefereeModule {}
