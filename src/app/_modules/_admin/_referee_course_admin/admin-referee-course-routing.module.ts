import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/schiri-kurse',
    pathMatch: 'full',
    component: Views.CourseImportIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiri-kurse/:id',
    pathMatch: 'full',
    component: Views.CourseImportDetailComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiri-kurse-freigabe',
    pathMatch: 'full',
    component: Views.CourseReviewIndexComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRefereeCourseRoutingModule {}
