import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/schiedsrichter',
    pathMatch: 'full',
    component: Views.RefereeIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiedsrichter/neu',
    pathMatch: 'full',
    component: Views.RefereeEditComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiedsrichter/zusatzqualifikationen',
    pathMatch: 'full',
    component: Views.RefereeQualificationTypesComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiedsrichter/lizenzstufen',
    pathMatch: 'full',
    component: Views.RefereeLicenseLevelsComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiedsrichter/:lizenznummer',
    pathMatch: 'full',
    component: Views.RefereeDetailComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiedsrichter/:lizenznummer/bearbeiten',
    pathMatch: 'full',
    component: Views.RefereeEditComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiedsrichter/:lizenznummer/duplikat',
    pathMatch: 'full',
    component: Views.RefereeMergeComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRefereeRoutingModule {}
