import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/spielbetriebe',
    pathMatch: 'full',
    component: Views.GameOperationIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/spielbetriebe/neu',
    pathMatch: 'full',
    component: Views.GameOperationEditComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/spielbetriebe/:id/bearbeiten',
    pathMatch: 'full',
    component: Views.GameOperationEditComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminGameOperationRoutingModule {}
