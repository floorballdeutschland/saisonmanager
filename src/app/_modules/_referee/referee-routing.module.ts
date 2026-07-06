import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'schiedsrichter/ausweis',
    pathMatch: 'full',
    component: Views.RefereeCardComponent,
    data: { scrollTop: true },
  },
  {
    path: 'schiedsrichter/profil',
    pathMatch: 'full',
    component: Views.RefereeProfileComponent,
    data: { scrollTop: true },
  },
  {
    path: 'schiedsrichter/spieltage',
    pathMatch: 'full',
    component: Views.RefereeGameDaysComponent,
    data: { scrollTop: true },
  },
  {
    path: 'schiedsrichter/verfuegbarkeiten',
    pathMatch: 'full',
    component: Views.RefereeAvailabilitiesComponent,
    data: { scrollTop: true },
  },
  {
    path: 'schiedsrichter/historie',
    pathMatch: 'full',
    component: Views.RefereeHistoryComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RefereeRoutingModule {}
