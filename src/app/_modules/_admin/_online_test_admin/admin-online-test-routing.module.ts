import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/onlinepruefungen',
    pathMatch: 'full',
    component: Views.OnlineTestIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/onlinepruefungen/neu',
    pathMatch: 'full',
    component: Views.OnlineTestEditComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/onlinepruefungen/:id/bearbeiten',
    pathMatch: 'full',
    component: Views.OnlineTestEditComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/onlinepruefungen/:id/fragen',
    pathMatch: 'full',
    component: Views.OnlineTestQuestionsComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/onlinepruefungen/:id/zuweisung',
    pathMatch: 'full',
    component: Views.OnlineTestAssignmentsComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/onlinepruefungen/:id/ergebnisse',
    pathMatch: 'full',
    component: Views.OnlineTestResultsComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminOnlineTestRoutingModule {}
