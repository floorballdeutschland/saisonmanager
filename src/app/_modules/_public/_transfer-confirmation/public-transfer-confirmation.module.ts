import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicTransferConfirmationRoutingModule } from './public-transfer-confirmation-routing.module';
import * as Views from './views';

@NgModule({
  declarations: [Views.TransferConfirmationComponent],
  imports: [
    CommonModule,
    RouterModule,
    PublicTransferConfirmationRoutingModule,
  ],
})
export class PublicTransferConfirmationModule {}
