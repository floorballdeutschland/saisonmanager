import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminLicenseRoutingModule } from './admin-license-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';

import * as Views from './views';
import {
  AdditionalClubFilterPipe,
  ClubPlayerLicensePipe,
  SortPlayersPipe,
} from 'src/app/_helpers';
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
    SortPlayersPipe,
    AdditionalClubFilterPipe,
    ClubPlayerLicensePipe,
    LicenseUserLeagueDetailComponent,
    LicenseUserLeagueIndexComponent,
  ],
})
export class AdminLicenseModule {}
