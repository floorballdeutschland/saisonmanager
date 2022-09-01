import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminLeagueRoutingModule } from './admin-schedule-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminLeagueRoutingModule,
    UikitCommonModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  declarations: [
    Views.ScheduleIndexComponent,
    Views.GameDayEditComponent,
    Views.ImportGameDaysComponent,
  ],
})
export class AdminScheduleModule {}
