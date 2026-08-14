import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from 'src/app/_helpers/_guards/permission.guard';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/vereine',
    pathMatch: 'full',
    component: Views.ClubIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/vereine/:clubId/bearbeiten',
    pathMatch: 'full',
    component: Views.ClubEditComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    // Eigener Guard: Die Anlage setzt den Heimat-Spielbetrieb und bleibt beim
    // Verband. Ohne ihn bekam ein Vereinsmanager das vollstaendige Formular zu
    // sehen und erst beim Speichern eine Fehlermeldung.
    path: 'verwaltung/vereine/neu',
    pathMatch: 'full',
    component: Views.ClubEditComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: 'club_create',
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminClubRoutingModule {}
