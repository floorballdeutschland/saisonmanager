import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    // `verwaltung/`-Präfix zwingend: /verein/spieltage (TM/VM) und
    // /schiedsrichter/spieltage sind bereits belegt.
    path: 'verwaltung/spielberichte',
    pathMatch: 'full',
    component: Views.MatchReportIndexComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminMatchReportRoutingModule {}
