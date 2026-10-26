import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Views from './views';

/**
 * Auswaertsspieltage: dem Spieltagsbericht widersprechen oder ihn bestaetigen,
 * ohne eigene Route. Die Seite ist ein Reiter
 * von „Spieltagsaufgaben" (`@floorball/club-game-day`, fe#586).
 */
@NgModule({
  imports: [CommonModule, FormsModule, UikitCommonModule],
  declarations: [Views.TeamGameDaysComponent],
  exports: [Views.TeamGameDaysComponent],
})
export class TeamGameDaysModule {}
