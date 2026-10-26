import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { MatchReportModule } from '@floorball/public/association/match-report';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';

import * as Components from './_components';
import * as Views from './_views';
import { PublicAssociationMatchRoutingModule } from './public-association-match-routing.module';

@NgModule({
  declarations: [
    Views.MatchComponent,
    Views.MatchPublicComponent,
    Components.MatchDetailedStatsComponent,
    Components.MatchHighlightsComponent,
    Components.MatchHighlightsPanelComponent,
    Components.ShotChartComponent,
    Components.FreeHitChartComponent,
    Components.RinkMarkingsComponent,
  ],
  imports: [
    CommonModule,
    PublicAssociationMatchRoutingModule,
    UikitCommonModule,
    UikitMatchesModule,
    UikitTeamModule,
    UikitPlayerModule,
    FormsModule,
    RouterModule,
    MatchReportModule,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'match', alias: 'match' },
      multi: true,
    },
  ],
})
export class PublicAssociationMatchModule {}
