import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminStateAssociationRoutingModule } from './admin-state-association-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminStateAssociationRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.StateAssociationIndexComponent,
    Views.StateAssociationEditComponent,
  ],
})
export class AdminStateAssociationModule {}
