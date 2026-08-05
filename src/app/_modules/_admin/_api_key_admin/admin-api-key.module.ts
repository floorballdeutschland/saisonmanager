import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminApiKeyRoutingModule } from './admin-api-key-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminApiKeyRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.ApiKeyIndexComponent,
    Views.ApiKeyApplicationIndexComponent,
    Views.ApiKeyUsageComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/api-keys', alias: 'apiKeys' },
      multi: true,
    },
  ],
})
export class AdminApiKeyModule {}
