import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminGameOperationRoutingModule } from './admin-game-operation-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminGameOperationRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.GameOperationIndexComponent,
    Views.GameOperationEditComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/game-operation',
        alias: 'gameOperationAdmin',
      },
      multi: true,
    },
  ],
})
export class AdminGameOperationModule {}
