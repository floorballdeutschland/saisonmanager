import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { permissionGuard } from '../../../_helpers/_guards/permission.guard';
import * as Views from './views';

// Guards sitzen pro Kind-Route statt am Modul. Die Spieler-Detail-/Bearbeiten-
// Seite steuern auch Vereins-/Teammanager über ihre eigene Spielerliste
// (spieler-verein) an, daher gilt dort dasselbe Gate wie am dortigen Einstieg
// (`menu_item_player_vm`, VM+TM). Alle übrigen Ansichten (Gesamtliste, Suche,
// vereinsbezogene Adminliste, Neuanlage, Dublettenzusammenführung) bleiben
// Admin/SBK vorbehalten; VM/TM landen nach dem Speichern wieder auf
// spieler-verein. Der Server erzwingt die eigentliche Autorisierung.
const PLAYER_ADMIN = 'menu_item_player_admin';
const PLAYER_SHARED = ['menu_item_player_admin', 'menu_item_player_vm'];

const routes: Routes = [
  {
    path: 'verwaltung/spieler/:id/duplikat',
    pathMatch: 'full',
    component: Views.PlayerMergeComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: PLAYER_ADMIN,
    },
  },
  {
    path: 'verwaltung/spieler/suche',
    pathMatch: 'full',
    component: Views.PlayerSearchComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: PLAYER_ADMIN,
    },
  },
  {
    path: 'verwaltung/vereine/alle/spieler',
    pathMatch: 'full',
    component: Views.PlayerIndexComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: PLAYER_ADMIN,
    },
  },
  {
    path: 'verwaltung/vereine/:clubId/spieler',
    pathMatch: 'full',
    component: Views.PlayerIndexComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: PLAYER_ADMIN,
    },
  },
  {
    path: 'verwaltung/vereine/:clubId/spieler/:playerId/bearbeiten',
    pathMatch: 'full',
    component: Views.PlayerEditComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: PLAYER_SHARED,
    },
  },
  {
    path: 'verwaltung/vereine/:clubId/spieler/neu',
    pathMatch: 'full',
    component: Views.PlayerEditComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: PLAYER_ADMIN,
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminPlayerRoutingModule {}
