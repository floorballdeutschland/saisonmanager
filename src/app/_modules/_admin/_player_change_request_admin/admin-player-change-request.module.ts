import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminPlayerChangeRequestRoutingModule } from './admin-player-change-request-routing.module';
import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminPlayerChangeRequestRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.PlayerChangeRequestListComponent],
})
export class AdminPlayerChangeRequestModule {}
