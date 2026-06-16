import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { AdminLeagueRoutingModule } from './admin-schedule-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Views from './views';
import { GameEditComponent } from './views/game-edit/game-edit.component';

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
    GameEditComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/schedule', alias: 'scheduleAdmin' },
      multi: true,
    },
  ],
})
export class AdminScheduleModule {}
