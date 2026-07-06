import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { permissionGuard } from '../../../_helpers/_guards/permission.guard';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/lizenzwesen/verein',
    pathMatch: 'full',
    component: Views.LicenseClubIndexComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: 'menu_item_licence_club_admin',
    },
  },
  {
    // Team-Detail ist aus mehreren Kontexten (Verein/Verband) erreichbar –
    // kein eindeutiger Menü-Schlüssel, daher bewusst ungeschützt.
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
    component: Views.LicenseAdminGlobalListComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: 'menu_item_licence_admin',
    },
  },
  {
    path: 'verwaltung/lizenzwesen/verband/liga/:leagueId',
    pathMatch: 'full',
    component: Views.LicenseAdminLeagueDetailComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: 'menu_item_licence_admin',
    },
  },
  {
    path: 'verwaltung/lizenzwesen/lizenzlisten',
    pathMatch: 'full',
    component: Views.LicenseUserLeagueIndexComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: 'menu_item_licence_list',
    },
  },
  {
    path: 'verwaltung/lizenzwesen/lizenzlisten/liga/:leagueId',
    pathMatch: 'full',
    component: Views.LicenseUserLeagueDetailComponent,
    canActivate: [permissionGuard],
    data: {
      scrollTop: true,
      permission: 'menu_item_licence_list',
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminLicenseRoutingModule {}
