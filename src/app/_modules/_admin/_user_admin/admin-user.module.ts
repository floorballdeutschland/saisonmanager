import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminUserRoutingModule } from './admin-user-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminUserRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.UserIndexComponent, Views.UserEditComponent],
})
export class AdminUserModule {}
