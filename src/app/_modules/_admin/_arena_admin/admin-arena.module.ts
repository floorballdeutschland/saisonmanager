import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { AdminArenaRoutingModule } from './admin-arena-routing.module';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminArenaRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.ArenaIndexComponent,
    Views.ArenaEditComponent,
    Views.ArenaMergeComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/arena', alias: 'arena' },
      multi: true,
    },
  ],
})
export class AdminArenaModule {}
