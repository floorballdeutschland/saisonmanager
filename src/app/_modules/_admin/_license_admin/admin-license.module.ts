import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { AdminLicenseRoutingModule } from './admin-license-routing.module';

import * as Views from './views';
import { LicenseUserLeagueDetailComponent } from './views/license-user-league-detail/license-user-league-detail.component';
import { LicenseUserLeagueIndexComponent } from './views/license-user-league-index/license-user-league-index.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminLicenseRoutingModule,
    UikitPlayerModule,
    UikitTeamModule,
    UikitMatchesModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.LicenseClubIndexComponent,
    Views.LicenseTeamDetailComponent,
    Views.LicenseAdminTeamEntryComponent,
    Views.LicenseAdminIndexComponent,
    Views.LicenseAdminLeagueDetailComponent,
    Views.LicenseAdminDetailComponent,
    LicenseUserLeagueDetailComponent,
    LicenseUserLeagueIndexComponent,
  ],
})
export class AdminLicenseModule {}
