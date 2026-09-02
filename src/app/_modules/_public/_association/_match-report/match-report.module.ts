import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import * as Views from './_views';
import * as Components from './_components';
import { MatchEventFormModule } from './_components/match-event-form/match-event-form.module';

@NgModule({
  declarations: [
    Components.AwardsComponent,
    Components.OverlayLinksComponent,
    Components.StartingPlayerComponent,
    Components.StreamGraphicsComponent,
    Views.MatchReportComponent,
    Views.MatchReportIntroComponent,
    Views.MatchReportStepOneComponent,
    Views.MatchReportStepTwoComponent,
    Views.MatchReportStepThreeComponent,
  ],
  // Die Thumbnails stehen auch in der öffentlichen Spielansicht, also außerhalb
  // dieses Moduls: Ein Highlightvideo entsteht Tage nach dem Spiel, wenn der
  // Spielbericht längst geschlossen ist.
  exports: [Views.MatchReportComponent, Components.StreamGraphicsComponent],
  imports: [
    CommonModule,
    UikitCommonModule,
    UikitMatchesModule,
    UikitTeamModule,
    UikitPlayerModule,
    FormsModule,
    MatchEventFormModule,
  ],
})
export class MatchReportModule {}
