import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { permissionGuard } from '../../../_helpers/_guards/permission.guard';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/schiedsrichter',
    pathMatch: 'full',
    component: Views.RefereeIndexComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_admin' },
  },
  {
    path: 'verwaltung/schiedsrichter/neu',
    pathMatch: 'full',
    component: Views.RefereeEditComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_admin' },
  },
  {
    path: 'verwaltung/schiedsrichter/zusatzqualifikationen',
    pathMatch: 'full',
    component: Views.RefereeQualificationTypesComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_admin' },
  },
  {
    path: 'verwaltung/schiedsrichter/lizenzstufen',
    pathMatch: 'full',
    component: Views.RefereeLicenseLevelsComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_admin' },
  },
  {
    path: 'verwaltung/schiedsrichter/tags',
    pathMatch: 'full',
    component: Views.RefereeTagsComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_admin' },
  },
  {
    // Einstellungen sind separat berechtigt (menu_item_referee_settings) und
    // müssen vor der :lizenznummer-Wildcard-Route stehen.
    path: 'verwaltung/schiedsrichter/einstellungen',
    pathMatch: 'full',
    component: Views.RefereeSettingsComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_settings' },
  },
  {
    path: 'verwaltung/schiedsrichter/:lizenznummer',
    pathMatch: 'full',
    component: Views.RefereeDetailComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_admin' },
  },
  {
    path: 'verwaltung/schiedsrichter/:lizenznummer/bearbeiten',
    pathMatch: 'full',
    component: Views.RefereeEditComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_admin' },
  },
  {
    path: 'verwaltung/schiedsrichter/:lizenznummer/duplikat',
    pathMatch: 'full',
    component: Views.RefereeMergeComponent,
    canActivate: [permissionGuard],
    data: { scrollTop: true, permission: 'menu_item_referee_admin' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRefereeRoutingModule {}
