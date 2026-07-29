import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Components from './components';

/**
 * Der Fragebogen als eigenes Modul, damit beide Abgabewege ihn teilen: die
 * angemeldete Team-Übersicht und die öffentliche Seite mit Einmal-Link
 * (@floorball/public/referee-feedback).
 */
@NgModule({
  imports: [CommonModule, FormsModule, UikitCommonModule],
  declarations: [Components.RefereeFeedbackFormComponent],
  exports: [Components.RefereeFeedbackFormComponent],
})
export class RefereeFeedbackSharedModule {}
