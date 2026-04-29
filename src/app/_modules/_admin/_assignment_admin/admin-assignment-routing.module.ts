import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/schiedsrichter-ansetzungen',
    pathMatch: 'full',
    component: Views.AssignmentIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiedsrichter-ansetzungen/:gameId',
    pathMatch: 'full',
    component: Views.AssignmentEditComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminAssignmentRoutingModule {}
