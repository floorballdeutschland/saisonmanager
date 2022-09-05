import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        loadChildren: () =>
          import('@floorball/public/home').then((m) => m.PublicHomeModule),
      },

      {
        path: '',
        loadChildren: () =>
          import('@floorball/public/login').then((m) => m.PublicLoginModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/league').then((m) => m.AdminLeagueModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/club').then((m) => m.AdminClubModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/player').then((m) => m.AdminPlayerModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/teams').then((m) => m.AdminTeamModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/schedule').then(
            (m) => m.AdminScheduleModule
          ),
      },
    ],
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/association/host').then(
        (m) => m.PublicAssociationHostModule
      ),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      paramsInheritanceStrategy: 'always',
      scrollPositionRestoration: 'top',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
