import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PublicAssociationMatchRoutingModule } from './public-association-match-routing.module';

import * as Views from './_views';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitTeamModule } from '@floorball/uikit/team';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { MatchReportStepOneComponent } from './_views/match-report-step-one/match-report-step-one.component';
import { MatchReportStepThreeComponent } from './_views/match-report-step-three/match-report-step-three.component';
import { MatchReportStepTwoComponent } from './_views/match-report-step-two/match-report-step-two.component';

@NgModule({
  declarations: [
    Views.MatchComponent,
    Views.MatchEventFormComponent,
    Views.MatchPublicComponent,
    Views.MatchReportComponent,
    MatchReportStepOneComponent,
    MatchReportStepThreeComponent,
    MatchReportStepTwoComponent,
  ],
  imports: [
    CommonModule,
    PublicAssociationMatchRoutingModule,
    UikitCommonModule,
    UikitMatchesModule,
    UikitTeamModule,
    UikitPlayerModule,
    FormsModule,
  ],
})
export class PublicAssociationMatchModule {}
