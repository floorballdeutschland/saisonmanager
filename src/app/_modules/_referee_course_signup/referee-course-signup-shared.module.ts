import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { CourseOfferComponent } from './components/course-offer/course-offer.component';
import { CourseSignupFieldsComponent } from './components/course-signup-fields/course-signup-fields.component';

/**
 * Kurskarte und Anmeldefelder, geteilt von Schiri-Portal, Verein und der
 * öffentlichen Seite. Der Transloco-Scope hängt hier, damit jeder importierende
 * Lazy-Bereich die Texte auflöst (siehe RefereeFeedbackSharedModule).
 */
@NgModule({
  imports: [CommonModule, FormsModule, UikitCommonModule],
  declarations: [CourseOfferComponent, CourseSignupFieldsComponent],
  exports: [CourseOfferComponent, CourseSignupFieldsComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'referee-course-signup', alias: 'courseSignup' },
      multi: true,
    },
  ],
})
export class RefereeCourseSignupSharedModule {}
