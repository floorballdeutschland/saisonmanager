import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { permissionGuard } from '../../../_helpers/_guards/permission.guard';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/schiri-kurse',
    pathMatch: 'full',
    component: Views.CourseImportIndexComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_course_import' },
  },
  {
    path: 'verwaltung/schiri-kurse/:id',
    pathMatch: 'full',
    component: Views.CourseImportDetailComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_course_import' },
  },
  {
    path: 'verwaltung/schiri-kurse-freigabe',
    pathMatch: 'full',
    component: Views.CourseReviewIndexComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_course_review' },
  },
  // Kurse im System. Die festen Pfade (neu, vorlagen) stehen vor :id.
  ...[
    { path: '', component: Views.CourseIndexComponent },
    { path: 'neu', component: Views.CourseEditComponent },
    { path: 'vorlagen', component: Views.CourseFieldTemplatesComponent },
    { path: ':id', component: Views.CourseDetailComponent },
    { path: ':id/bearbeiten', component: Views.CourseEditComponent },
  ].map((route) => ({
    ...route,
    path: route.path
      ? `verwaltung/schiri-kurse-planung/${route.path}`
      : 'verwaltung/schiri-kurse-planung',
    pathMatch: 'full' as const,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_courses' },
  })),
  // „Meine Kurse" der Kursleitung.
  {
    path: 'verwaltung/meine-kurse',
    pathMatch: 'full',
    component: Views.LeadCourseIndexComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_courses_lead' },
  },
  {
    path: 'verwaltung/meine-kurse/:id',
    pathMatch: 'full',
    component: Views.LeadCourseDetailComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_courses_lead' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRefereeCourseRoutingModule {}
