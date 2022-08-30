import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/ligen/:leagueId/teams',
    pathMatch: 'full',
    component: Views.TeamIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/teams/:teamId/bearbeiten',
    pathMatch: 'full',
    component: Views.TeamEditComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/ligen/:leagueId/teams/neu',
    pathMatch: 'full',
    component: Views.TeamEditComponent,
    data: {
      scrollTop: true,
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminTeamRoutingModule {}
