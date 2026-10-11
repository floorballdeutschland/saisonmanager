import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeCourseSignupRoutingModule } from './referee-course-signup-routing.module';
import { RefereeCourseSignupSharedModule } from './referee-course-signup-shared.module';
import { PortalCoursesComponent } from './views/portal-courses/portal-courses.component';
import { ClubCoursesComponent } from './views/club-courses/club-courses.component';

/** Kursanmeldung im Schiri-Portal und durch den Verein. */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    UikitCommonModule,
    RefereeCourseSignupRoutingModule,
    RefereeCourseSignupSharedModule,
  ],
  declarations: [PortalCoursesComponent, ClubCoursesComponent],
})
export class RefereeCourseSignupModule {}
