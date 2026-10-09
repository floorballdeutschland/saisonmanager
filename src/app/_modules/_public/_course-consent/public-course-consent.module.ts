import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeCourseSignupSharedModule } from '@floorball/referee-course-signup';
import { CourseGuardianConsentComponent } from './course-guardian-consent.component';

/** Öffentliche Einwilligungsseite der Erziehungsberechtigten. */
@NgModule({
  imports: [
    CommonModule,
    UikitCommonModule,
    // Bringt den Transloco-Scope der Kursanmeldung mit.
    RefereeCourseSignupSharedModule,
    RouterModule.forChild([
      {
        path: 'kurs-einwilligung/:token',
        pathMatch: 'full',
        component: CourseGuardianConsentComponent,
        data: { scrollTop: true },
      },
    ]),
  ],
  declarations: [CourseGuardianConsentComponent],
})
export class PublicCourseConsentModule {}
