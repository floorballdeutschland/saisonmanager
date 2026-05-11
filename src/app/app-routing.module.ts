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
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/licenses').then((m) => m.AdminLicenseModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/referees').then((m) => m.AdminRefereeModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/referee-vm').then(
            (m) => m.AdminRefereeVmModule
          ),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/assignment').then(
            (m) => m.AdminAssignmentModule
          ),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/state-associations').then(
            (m) => m.AdminStateAssociationModule
          ),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/api-keys').then((m) => m.AdminApiKeyModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/transfer-requests').then(
            (m) => m.AdminTransferRequestModule
          ),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/referee').then((m) => m.RefereeModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/users').then((m) => m.AdminUserModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/arena').then((m) => m.AdminArenaModule),
      },
    ],
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/player').then((m) => m.PublicPlayerModule),
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/referee-license').then(
        (m) => m.PublicRefereeLicenseModule
      ),
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/license-list').then(
        (m) => m.PublicLicenseListModule
      ),
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/secretary').then(
        (m) => m.PublicSecretaryModule
      ),
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
