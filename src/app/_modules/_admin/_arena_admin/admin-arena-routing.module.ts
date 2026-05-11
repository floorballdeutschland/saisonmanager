import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/spielorte',
    pathMatch: 'full',
    component: Views.ArenaIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/spielorte/neu',
    pathMatch: 'full',
    component: Views.ArenaEditComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/spielorte/:arenaId/bearbeiten',
    pathMatch: 'full',
    component: Views.ArenaEditComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminArenaRoutingModule {}
