import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/ligen/:leagueId/spielplan',
    pathMatch: 'full',
    component: Views.ScheduleIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/spieltag/:gameDayId/bearbeiten',
    pathMatch: 'full',
    component: Views.GameDayEditComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/spieltag/import',
    pathMatch: 'full',
    component: Views.ImportGameDaysComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/spieltag/neu',
    pathMatch: 'full',
    component: Views.GameDayEditComponent,
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
