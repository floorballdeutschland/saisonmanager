import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/vereine',
    pathMatch: 'full',
    component: Views.ClubIndexComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/vereine/:clubId/bearbeiten',
    pathMatch: 'full',
    component: Views.ClubEditComponent,
    data: {
      scrollTop: true,
    },
  },
  {
    path: 'verwaltung/vereine/neu',
    pathMatch: 'full',
    component: Views.ClubEditComponent,
    data: {
      scrollTop: true,
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class AdminClubRoutingModule {}
