import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/vereine/:clubId/spieler',
    pathMatch: 'full',
    component: Views.PlayerIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/spieler/:playerId/bearbeiten',
    pathMatch: 'full',
    component: Views.PlayerEditComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/spieler/neu',
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
