import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminLicenseRoutingModule } from './admin-license-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitMatchesModule } from '@floorball/uikit/matches';

import * as Views from './views';
import { SortPlayersPipe } from 'src/app/_helpers';

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
    SortPlayersPipe,
  ],
})
export class AdminLicenseModule {}
