import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import * as Views from './_views';
import * as Components from './_components';

@NgModule({
  declarations: [
    Components.AwardsComponent,
    Components.MatchEventFormComponent,
    Components.StartingPlayerComponent,
    Views.MatchReportComponent,
    Views.MatchReportIntroComponent,
    Views.MatchReportStepOneComponent,
    Views.MatchReportStepTwoComponent,
    Views.MatchReportStepThreeComponent,
  ],
  exports: [Views.MatchReportComponent],
  imports: [
    CommonModule,
    UikitCommonModule,
    UikitMatchesModule,
    UikitTeamModule,
    UikitPlayerModule,
    FormsModule,
  ],
})
export class MatchReportModule {}
