import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/transfer-anfragen',
    pathMatch: 'full',
    component: Views.TransferRequestListComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/transfer-anfragen/neu',
    pathMatch: 'full',
    component: Views.TransferRequestInitiateComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/transfer-anfragen/direktzuweisung',
    pathMatch: 'full',
    component: Views.TransferRequestDirectComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/transfer-anfragen/:id',
    pathMatch: 'full',
    component: Views.TransferRequestDetailComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminTransferRequestRoutingModule {}
