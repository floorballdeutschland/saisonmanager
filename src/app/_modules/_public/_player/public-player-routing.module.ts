import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './_views';

const routes: Routes = [
  {
    path: 'spieler/:playerId',
    component: Views.PlayerStatsComponent,
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicPlayerRoutingModule {}
