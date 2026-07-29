import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RefereeFeedbackSharedModule } from '@floorball/referee-feedback';
import { PublicRefereeFeedbackRoutingModule } from './public-referee-feedback-routing.module';
import * as Views from './views';

/**
 * Öffentliche Abgabe des Schiri-Feedbacks über einen Einmal-Link, ohne
 * Anmeldung. Der Fragebogen kommt aus dem RefereeFeedbackSharedModule, damit die
 * Fragen nur an einer Stelle gepflegt werden.
 */
@NgModule({
  declarations: [Views.RefereeFeedbackSubmitComponent],
  imports: [
    CommonModule,
    RouterModule,
    RefereeFeedbackSharedModule,
    PublicRefereeFeedbackRoutingModule,
  ],
})
export class PublicRefereeFeedbackModule {}
