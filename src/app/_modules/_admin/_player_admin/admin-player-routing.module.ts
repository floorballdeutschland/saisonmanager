import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PlayerStatisticsComponent } from '@floorball/admin/player-stats';

import { permissionGuard } from '../../../_helpers/_guards/permission.guard';
import * as Views from './views';

// Guards sitzen pro Kind-Route statt am Modul. Die Spieler-Detail-/Bearbeiten-
// und die Neuanlage-Seite steuern auch Vereins-/Teammanager über ihre eigene
// Spielerliste (spieler-verein) an, daher gilt dort dasselbe Gate wie am
// dortigen Einstieg (`menu_item_player_vm`, VM+TM).
//
// Der Guard ist bewusst weiter als das Recht: Anlegen darf seit api#530 nur der
// Vereinsmanager des Vereins (`create_player` in Club#user_permissions), und die
// spieler-verein-Liste prüft das je Verein (`manage_players` aus
// vm/clubs_and_teams, canManagePlayers). Ein Teammanager, der die Route trotzdem
// aufruft, bekommt die Maske lesend samt Begründung (createNotAllowed in
// player-edit) statt einer Sackgasse; die Autorisierung erzwingt die API.
//
// Die übrigen Ansichten (Gesamtliste, Suche, vereinsbezogene Adminliste,
// Dublettenzusammenführung) bleiben Admin/SBK vorbehalten; VM/TM landen nach
// dem Speichern wieder auf spieler-verein.
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
    // Rangliste ueber den eigenen Spielbetrieb. Ohne :clubId antwortet die API
    // im Verbandsmodus und laesst nur Admin und SBK herein; Vereins- und
    // Teammanager kommen ueber spieler-verein an genau ihre Vereine.
    path: 'verwaltung/spieler/spielerdaten',
    pathMatch: 'full',
    component: PlayerStatisticsComponent,
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
      permission: PLAYER_SHARED,
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminPlayerRoutingModule {}
