import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/spieler/suche',
    pathMatch: 'full',
    component: Views.PlayerSearchComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/vereine/alle/spieler',
    pathMatch: 'full',
    component: Views.PlayerIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/vereine/:clubId/spieler',
    pathMatch: 'full',
    component: Views.PlayerIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/vereine/:clubId/spieler/:playerId/bearbeiten',
    pathMatch: 'full',
    component: Views.PlayerEditComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/vereine/:clubId/spieler/neu',
    pathMatch: 'full',
    component: Views.PlayerEditComponent,
    data: {
      scrollTop: true,
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminPlayerRoutingModule {}
