import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
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
})
export class AdminArenaModule {}
