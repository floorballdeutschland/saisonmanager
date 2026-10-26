import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { RefereeFeedbackSharedModule } from './referee-feedback-shared.module';

import * as Views from './views';

/**
 * Schiri-Feedback des Vereins, ohne eigene Route: Die Seite ist ein Reiter
 * von „Spieltagsaufgaben" (`@floorball/club-game-day`, fe#586).
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RefereeFeedbackSharedModule,
    UikitCommonModule,
  ],
  declarations: [Views.RefereeFeedbackComponent],
  exports: [Views.RefereeFeedbackComponent],
})
export class RefereeFeedbackModule {}
