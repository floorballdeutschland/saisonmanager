import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
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
    path: 'schiedsrichter/sperrtermine',
    pathMatch: 'full',
    component: Views.RefereeBlockedDatesComponent,
    data: { scrollTop: true },
  },
  {
    path: 'schiedsrichter/historie',
    pathMatch: 'full',
    component: Views.RefereeHistoryComponent,
    data: { scrollTop: true },
  },
  {
    path: 'schiedsrichter/onlinepruefungen',
    pathMatch: 'full',
    component: Views.RefereeOnlineTestIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'schiedsrichter/onlinepruefungen/:id',
    pathMatch: 'full',
    component: Views.RefereeOnlineTestDetailComponent,
    data: { scrollTop: true },
  },
  {
    path: 'schiedsrichter/onlinepruefungen/:id/pruefung',
    pathMatch: 'full',
    component: Views.RefereeOnlineTestExamComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RefereeRoutingModule {}
