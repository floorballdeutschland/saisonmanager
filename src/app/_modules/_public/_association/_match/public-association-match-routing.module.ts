import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import * as Views from './_views';

const routes: Routes = [
  {
    path: 'spiel/:matchId',
    component: Views.MatchComponent,
    data: {
      scrollTop: true,
    },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicAssociationMatchRoutingModule {}
