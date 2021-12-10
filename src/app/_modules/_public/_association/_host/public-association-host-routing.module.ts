import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './_views';

const routes: Routes = [
  {
    path: ':association',
    component: Views.AssociationHostComponent,
    children: [
      {
        path: ':leagueId',
        component: Views.LeagueHostComponent,
        children: [
          {
            path: '',
            loadChildren: () =>
              import('@floorball/public/association/overview').then(
                (m) => m.PublicAssociationOverviewModule
              ),
          },
          {
            path: '',
            loadChildren: () =>
              import('@floorball/public/association/ranking').then(
                (m) => m.PublicAssociationRankingModule
              ),
          },
          {
            path: '',
            loadChildren: () =>
              import('@floorball/public/association/scorer').then(
                (m) => m.PublicAssociationScorerModule
              ),
          },
          {
            path: '',
            loadChildren: () =>
              import('@floorball/public/association/match').then(
                (m) => m.PublicAssociationMatchModule
              ),
          },
          {
            path: '',
            loadChildren: () =>
              import('@floorball/public/association/team').then(
                (m) => m.PublicAssociationTeamModule
              ),
          },
          {
            path: '',
            loadChildren: () =>
              import('@floorball/public/association/all-matches-overview').then(
                (m) => m.PublicAllMatchesOverviewModule
              ),
          },
        ],
      },
    ],
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicAssociationHostRoutingModule {}
