import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminTransferRequestRoutingModule } from './admin-transfer-request-routing.module';
import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminTransferRequestRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.TransferRequestListComponent,
    Views.TransferRequestInitiateComponent,
    Views.TransferRequestDetailComponent,
    Views.TransferRequestDirectComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/transfer-request',
        alias: 'transferRequestAdmin',
      },
      multi: true,
    },
  ],
})
export class AdminTransferRequestModule {}
