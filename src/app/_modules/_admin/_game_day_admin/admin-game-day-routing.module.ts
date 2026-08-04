import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    // `verwaltung/`-Präfix zwingend: /verein/spieltage (TM/VM) und
    // /schiedsrichter/spieltage sind bereits belegt.
    path: 'verwaltung/spieltage',
    pathMatch: 'full',
    component: Views.GameDayIndexComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminGameDayRoutingModule {}
