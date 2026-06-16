import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminRefereeRoutingModule } from './admin-referee-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminRefereeRoutingModule,
    UikitCommonModule,
  ],
  declarations: [
    Views.RefereeIndexComponent,
    Views.RefereeEditComponent,
    Views.RefereeDetailComponent,
    Views.RefereeQualificationTypesComponent,
    Views.RefereeLicenseLevelsComponent,
    Views.RefereeSettingsComponent,
    Views.RefereeMergeComponent,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/referee', alias: 'refereeAdmin' },
      multi: true,
    },
  ],
})
export class AdminRefereeModule {}
