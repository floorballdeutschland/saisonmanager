import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminAssignmentRoutingModule } from './admin-assignment-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminAssignmentRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.AssignmentIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/assignment', alias: 'assignmentAdmin' },
      multi: true,
    },
  ],
})
export class AdminAssignmentModule {}
