import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminApiKeyRoutingModule } from './admin-api-key-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminApiKeyRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.ApiKeyIndexComponent],
})
export class AdminApiKeyModule {}
