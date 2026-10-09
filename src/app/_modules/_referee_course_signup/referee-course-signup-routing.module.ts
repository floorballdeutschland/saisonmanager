import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from '../../_helpers/_guards/permission.guard';
import { PortalCoursesComponent } from './views/portal-courses/portal-courses.component';
import { ClubCoursesComponent } from './views/club-courses/club-courses.component';

const routes: Routes = [
  {
    path: 'schiedsrichter/kurse',
    pathMatch: 'full',
    component: PortalCoursesComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_courses_portal' },
  },
  {
    path: 'verein/schiri-kurse',
    pathMatch: 'full',
    component: ClubCoursesComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_club_referee_courses' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RefereeCourseSignupRoutingModule {}
