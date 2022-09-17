import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/lizenzwesen/verein',
    pathMatch: 'full',
    component: Views.LicenseClubIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/lizenzwesen/team/:teamId',
    pathMatch: 'full',
    component: Views.LicenseTeamDetailComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/lizenzwesen/verband',
    pathMatch: 'full',
    component: Views.LicenseAdminIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/lizenzwesen/verband/liga/:leagueId',
    pathMatch: 'full',
    component: Views.LicenseAdminLeagueDetailComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/lizenzwesen/lizenzlisten',
    pathMatch: 'full',
    component: Views.LicenseUserLeagueIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/lizenzwesen/lizenzlisten/liga/:leagueId',
    pathMatch: 'full',
    component: Views.LicenseUserLeagueDetailComponent,
    data: {
      scrollTop: true,
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminLicenseRoutingModule {}
