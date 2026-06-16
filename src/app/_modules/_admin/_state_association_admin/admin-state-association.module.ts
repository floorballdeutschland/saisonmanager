import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
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
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/state-association',
        alias: 'stateAssociationAdmin',
      },
      multi: true,
    },
  ],
})
export class AdminStateAssociationModule {}
