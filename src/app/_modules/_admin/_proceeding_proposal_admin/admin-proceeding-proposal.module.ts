import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminProceedingProposalRoutingModule } from './admin-proceeding-proposal-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminProceedingProposalRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.ProceedingProposalIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/proceeding-proposal',
        alias: 'proceedingProposalAdmin',
      },
      multi: true,
    },
  ],
})
export class AdminProceedingProposalModule {}
