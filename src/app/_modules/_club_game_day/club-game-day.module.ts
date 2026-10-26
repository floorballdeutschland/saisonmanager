import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeFeedbackModule } from '@floorball/referee-feedback';
import { SecretaryLinksModule } from '@floorball/secretary-links';
import { TeamGameDaysModule } from '@floorball/team-game-days';
import { ClubGameDayRoutingModule } from './club-game-day-routing.module';

import * as Views from './views';

/**
 * „Spieltagsaufgaben" (fe#586): was ein Verein rund um einen Spieltag
 * erledigt, auf einer Seite mit Reitern statt als drei Menuepunkte. Die
 * Reiter sind die frueheren Seiten Spielsekretariat, Meine Auswaertsspieltage
 * und Schiri-Feedback; ihre Module liefern nur noch die Komponenten.
 */
@NgModule({
  imports: [
    CommonModule,
    ClubGameDayRoutingModule,
    UikitCommonModule,
    SecretaryLinksModule,
    TeamGameDaysModule,
    RefereeFeedbackModule,
  ],
  declarations: [Views.ClubGameDayComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'club-game-day', alias: 'clubGameDay' },
      multi: true,
    },
  ],
})
export class ClubGameDayModule {}
