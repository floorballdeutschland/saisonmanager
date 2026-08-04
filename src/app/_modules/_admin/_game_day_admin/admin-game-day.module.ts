import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminGameDayRoutingModule } from './admin-game-day-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminGameDayRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.GameDayIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/game-day', alias: 'gameDayAdmin' },
      multi: true,
    },
  ],
})
export class AdminGameDayModule {}
