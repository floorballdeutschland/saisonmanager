import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminOnlineTestRoutingModule } from './admin-online-test-routing.module';
import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminOnlineTestRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.OnlineTestIndexComponent,
    Views.OnlineTestEditComponent,
    Views.OnlineTestQuestionsComponent,
    Views.OnlineTestAssignmentsComponent,
    Views.OnlineTestResultsComponent,
  ],
})
export class AdminOnlineTestModule {}
