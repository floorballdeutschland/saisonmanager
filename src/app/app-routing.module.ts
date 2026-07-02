import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SelectivePreloadingStrategy } from './_helpers/selective-preloading.strategy';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        loadChildren: () =>
          import('@floorball/public/home').then((m) => m.PublicHomeModule),
        data: { preload: true },
      },

      {
        path: '',
        loadChildren: () =>
          import('@floorball/public/login').then((m) => m.PublicLoginModule),
        data: { preload: true },
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
          import('@floorball/admin/referee-courses').then(
            (m) => m.AdminRefereeCourseModule
          ),
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
          import('@floorball/admin/player-vm').then(
            (m) => m.AdminPlayerVmModule
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
          import('@floorball/admin/availability').then(
            (m) => m.AdminAvailabilityModule
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
          import('@floorball/admin/online-tests').then(
            (m) => m.AdminOnlineTestModule
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
          import('@floorball/admin/player-change-requests').then(
            (m) => m.AdminPlayerChangeRequestModule
          ),
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
          import('@floorball/admin/proceeding-proposal').then(
            (m) => m.AdminProceedingProposalModule
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
          import('@floorball/account').then((m) => m.AccountModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/team-game-days').then((m) => m.TeamGameDaysModule),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/referee-feedback').then(
            (m) => m.RefereeFeedbackModule
          ),
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
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/settings').then(
            (m) => m.AdminSettingsModule
          ),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/analytics').then(
            (m) => m.AdminAnalyticsModule
          ),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/email-log').then(
            (m) => m.AdminEmailLogModule
          ),
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/email-template').then(
            (m) => m.AdminEmailTemplateModule
          ),
      },
    ],
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/player').then((m) => m.PublicPlayerModule),
    data: { preload: true },
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/referee-license').then(
        (m) => m.PublicRefereeLicenseModule
      ),
    data: { preload: true },
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/license-list').then(
        (m) => m.PublicLicenseListModule
      ),
    data: { preload: true },
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/secretary').then(
        (m) => m.PublicSecretaryModule
      ),
    data: { preload: true },
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/association/host').then(
        (m) => m.PublicAssociationHostModule
      ),
    data: { preload: true },
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/transfer-confirmation').then(
        (m) => m.PublicTransferConfirmationModule
      ),
    data: { preload: true },
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      paramsInheritanceStrategy: 'always',
      scrollPositionRestoration: 'top',
      // Nur öffentliche Bereiche (data.preload=true) im Hintergrund vorladen –
      // die vielen, selten genutzten Admin-Module bleiben lazy und belasten den
      // initialen Start nicht mehr.
      preloadingStrategy: SelectivePreloadingStrategy,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
