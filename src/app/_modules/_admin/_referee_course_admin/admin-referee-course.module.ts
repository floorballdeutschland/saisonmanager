import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminRefereeCourseRoutingModule } from './admin-referee-course-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminRefereeCourseRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.CourseImportIndexComponent,
    Views.CourseImportDetailComponent,
    Views.CourseReviewIndexComponent,
  ],
})
export class AdminRefereeCourseModule {}
