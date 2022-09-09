import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminLicenseRoutingModule } from './admin-license-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';

import * as Views from './views';
import { AdditionalClubFilterPipe, SortPlayersPipe } from 'src/app/_helpers';
import { LicenseAdminIndexComponent } from './views/license-admin-index/license-admin-index.component';
import { LicenseAdminLeagueDetailComponent } from './views/license-admin-league-detail/license-admin-league-detail.component';
import { LicenseAdminDetailComponent } from './views/license-admin-detail/license-admin-detail.component';
import { ClubPlayerLicensePipe } from 'src/app/_helpers/_pipes/club-player-license.pipe';

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
    SortPlayersPipe,
    LicenseAdminIndexComponent,
    LicenseAdminLeagueDetailComponent,
    LicenseAdminDetailComponent,
    AdditionalClubFilterPipe,
    ClubPlayerLicensePipe,
  ],
})
export class AdminLicenseModule {}
