import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminRefereeCourseRoutingModule } from './admin-referee-course-routing.module';

import * as Views from './views';
import { CourseFieldEditorComponent } from './components/course-field-editor/course-field-editor.component';
import { CourseLeadsComponent } from './components/course-leads/course-leads.component';

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
    Views.CourseIndexComponent,
    Views.CourseEditComponent,
    Views.CourseDetailComponent,
    Views.CourseFieldTemplatesComponent,
    Views.LeadCourseIndexComponent,
    Views.LeadCourseDetailComponent,
    CourseFieldEditorComponent,
    CourseLeadsComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/referee-course', alias: 'refereeCourseAdmin' },
      multi: true,
    },
  ],
})
export class AdminRefereeCourseModule {}
