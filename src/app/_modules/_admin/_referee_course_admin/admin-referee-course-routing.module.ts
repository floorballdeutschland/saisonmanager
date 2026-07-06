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
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRefereeCourseRoutingModule {}
