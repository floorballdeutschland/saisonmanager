import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { IconsModule } from '../../_uikit/_icons/icons.module';
import { AdminLicenseRoutingModule } from './admin-license-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminLicenseRoutingModule,
    UikitPlayerModule,
    UikitTeamModule,
    UikitMatchesModule,
    UikitCommonModule,
    IconsModule,
  ],
  declarations: [
    Views.LicenseClubIndexComponent,
    Views.LicenseTeamDetailComponent,
    Views.LicenseAdminTeamEntryComponent,
    Views.LicenseAdminIndexComponent,
    Views.LicenseAdminLeagueDetailComponent,
    Views.LicenseAdminDetailComponent,
    Views.LicenseUserLeagueDetailComponent,
    Views.LicenseUserLeagueIndexComponent,
  ],
})
export class AdminLicenseModule {}
