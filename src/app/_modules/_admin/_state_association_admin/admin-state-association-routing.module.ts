import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/landesverbaende',
    pathMatch: 'full',
    component: Views.StateAssociationIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/landesverbaende/neu',
    pathMatch: 'full',
    component: Views.StateAssociationEditComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/landesverbaende/:id/bearbeiten',
    pathMatch: 'full',
    component: Views.StateAssociationEditComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminStateAssociationRoutingModule {}
