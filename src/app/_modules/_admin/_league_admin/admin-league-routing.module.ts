import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/ligen',
    pathMatch: 'full',
    component: Views.LeagueIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/ligen/:leagueId/bearbeiten',
    pathMatch: 'full',
    component: Views.LeagueEditComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/ligen/neu',
    pathMatch: 'full',
    component: Views.LeagueEditComponent,
    data: {
      scrollTop: true,
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminLeagueRoutingModule {}
