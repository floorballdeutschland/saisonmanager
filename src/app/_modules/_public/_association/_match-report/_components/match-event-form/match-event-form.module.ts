import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { MatchEventFormComponent } from './match-event-form.component';

@NgModule({
  declarations: [MatchEventFormComponent],
  exports: [MatchEventFormComponent],
  imports: [CommonModule, FormsModule, RouterModule, UikitCommonModule],
})
export class MatchEventFormModule {}
