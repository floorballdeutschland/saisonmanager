import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from 'src/app/_helpers/_guards/permission.guard';
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
  // Eigener Guard neben dem des Moduls: Das Modul steht auf
  // `menu_item_transfer_requests` (Admin, SBK und VM), diese Ansicht ist eine
  // Verbandsauskunft. Ohne ihn liefe ein Vereinsmanager, der die Adresse kennt,
  // in den 403 des Endpunkts und damit in ein Fehler-Popup.
  {
    path: 'verwaltung/transfer-anfragen/eingehend',
    pathMatch: 'full',
    component: Views.TransferRequestIncomingComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_transfer_requests_sbk' },
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
