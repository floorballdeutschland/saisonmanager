import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

/**
 * Die drei frueheren Einzelseiten leiten auf ihren Reiter weiter. Ihre
 * Adressen stehen in Lesezeichen und in Mails der API (`GameMailer`
 * verlinkt /verein/spieltage, `RefereeFeedbackMailer` /verein/schiri-feedback)
 * und muessen deshalb dauerhaft funktionieren.
 */
export const clubGameDayRoutes: Routes = [
  {
    path: 'verein/spieltag',
    pathMatch: 'full',
    component: Views.ClubGameDayComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verein/spielsekretariat',
    pathMatch: 'full',
    redirectTo: '/verein/spieltag',
  },
  {
    path: 'verein/spieltage',
    pathMatch: 'full',
    redirectTo: '/verein/spieltag?reiter=auswaerts',
  },
  {
    path: 'verein/schiri-feedback',
    pathMatch: 'full',
    redirectTo: '/verein/spieltag?reiter=schiri-feedback',
  },
];

@NgModule({
  imports: [RouterModule.forChild(clubGameDayRoutes)],
  exports: [RouterModule],
})
export class ClubGameDayRoutingModule {}
