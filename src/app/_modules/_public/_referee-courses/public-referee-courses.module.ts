import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeCourseSignupSharedModule } from '@floorball/referee-course-signup';
import { PublicCourseListComponent } from './views/course-list/public-course-list.component';
import { PublicCourseDetailComponent } from './views/course-detail/public-course-detail.component';
import { RegistrationLinkComponent } from './views/registration-link/registration-link.component';

/**
 * Öffentliche Kursseite: Angebot, Anmeldung ohne Konto und die Links aus den
 * Anmeldemails. Ohne Guard. Die Einbettung auf Verbandsseiten läuft über die
 * statische Seite /kurse-einbettung/ (außerhalb von Angular, ohne Seitenleiste).
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    UikitCommonModule,
    RefereeCourseSignupSharedModule,
    RouterModule.forChild([
      {
        path: 'schiri-kurse',
        pathMatch: 'full',
        component: PublicCourseListComponent,
        data: { scrollTop: true },
      },
      {
        path: 'schiri-kurse/:id',
        pathMatch: 'full',
        component: PublicCourseDetailComponent,
        data: { scrollTop: true },
      },
      {
        path: 'kurs-anmeldung/bestaetigen/:token',
        pathMatch: 'full',
        component: RegistrationLinkComponent,
        data: { scrollTop: true, kind: 'confirm' },
      },
      {
        path: 'kurs-anmeldung/abmelden/:token',
        pathMatch: 'full',
        component: RegistrationLinkComponent,
        data: { scrollTop: true, kind: 'cancel' },
      },
    ]),
  ],
  declarations: [
    PublicCourseListComponent,
    PublicCourseDetailComponent,
    RegistrationLinkComponent,
  ],
})
export class PublicRefereeCoursesModule {}
