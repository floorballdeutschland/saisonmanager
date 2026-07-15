import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SelectivePreloadingStrategy } from './_helpers/selective-preloading.strategy';
import { permissionGuard } from './_helpers/_guards/permission.guard';

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
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_league_admin' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/club').then((m) => m.AdminClubModule),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_league_admin' },
      },
      {
        // Die Spieler-Verwaltung bündelt admin-/SBK-eigene Ansichten
        // (Gesamtliste, Suche, Dublettenzusammenführung) mit der Spieler-
        // Detail-/Bearbeiten-Seite, die auch Vereins-/Teammanager über ihre
        // eigene Spielerliste (spieler-verein) ansteuern. Ein einziger
        // Modul-Gate mit `menu_item_player_admin` sperrt VM/TM aus – daher
        // sitzen die Guards auf den Kind-Routen in
        // admin-player-routing.module.ts.
        path: '',
        loadChildren: () =>
          import('@floorball/admin/player').then((m) => m.AdminPlayerModule),
      },
      {
        // Nur über die Liga-Verwaltung erreichbare Drill-Downs (kein eigener
        // Menüpunkt) – daher dasselbe Gate wie die Liga-Verwaltung selbst.
        path: '',
        loadChildren: () =>
          import('@floorball/admin/teams').then((m) => m.AdminTeamModule),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_league_admin' },
      },
      {
        // Nur über die Liga-Verwaltung erreichbare Drill-Downs (kein eigener
        // Menüpunkt) – daher dasselbe Gate wie die Liga-Verwaltung selbst.
        path: '',
        loadChildren: () =>
          import('@floorball/admin/schedule').then(
            (m) => m.AdminScheduleModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_league_admin' },
      },
      {
        // Lizenzwesen bündelt drei getrennt berechtigte Bereiche
        // (Liste/Verband/Verein) – die Guards sitzen deshalb auf den
        // Kind-Routen in admin-license-routing.module.ts.
        path: '',
        loadChildren: () =>
          import('@floorball/admin/licenses').then((m) => m.AdminLicenseModule),
      },
      {
        // Schiedsrichter-Verwaltung enthält zusätzlich die getrennt
        // berechtigten Einstellungen – Guards auf Kind-Routen in
        // admin-referee-routing.module.ts.
        path: '',
        loadChildren: () =>
          import('@floorball/admin/referees').then((m) => m.AdminRefereeModule),
      },
      {
        // Kursimport und Kursfreigabe sind getrennt berechtigt – Guards auf
        // Kind-Routen in admin-referee-course-routing.module.ts.
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
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_referee_vm' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/player-vm').then(
            (m) => m.AdminPlayerVmModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_player_vm' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/assignment').then(
            (m) => m.AdminAssignmentModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_referee_assignments' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/availability').then(
            (m) => m.AdminAvailabilityModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_referee_availability' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/state-associations').then(
            (m) => m.AdminStateAssociationModule
          ),
        canActivate: [permissionGuard],
        data: {
          permission: [
            'menu_item_state_association_admin',
            'menu_item_state_association_sbk',
          ],
        },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/document-types').then(
            (m) => m.AdminDocumentTypeModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_document_type_admin' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/api-keys').then((m) => m.AdminApiKeyModule),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_api_key_admin' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/player-change-requests').then(
            (m) => m.AdminPlayerChangeRequestModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_player_change_requests' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/transfer-requests').then(
            (m) => m.AdminTransferRequestModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_transfer_requests' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/proceeding-proposal').then(
            (m) => m.AdminProceedingProposalModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_proceeding_proposal_admin' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/referee').then((m) => m.RefereeModule),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_referee_profile' },
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
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_team_game_days' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/referee-feedback').then(
            (m) => m.RefereeFeedbackModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_referee_feedback' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/users').then((m) => m.AdminUserModule),
        canActivate: [permissionGuard],
        data: {
          permission: ['menu_item_user_admin', 'menu_item_user_vm'],
        },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/arena').then((m) => m.AdminArenaModule),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_arena_admin' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/settings').then(
            (m) => m.AdminSettingsModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_season_admin' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/analytics').then(
            (m) => m.AdminAnalyticsModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_analytics_admin' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/email-log').then(
            (m) => m.AdminEmailLogModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_email_log_admin' },
      },
      {
        path: '',
        loadChildren: () =>
          import('@floorball/admin/email-template').then(
            (m) => m.AdminEmailTemplateModule
          ),
        canActivate: [permissionGuard],
        data: { permission: 'menu_item_email_template_admin' },
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
