import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminDocumentTypeRoutingModule } from './admin-document-type-routing.module';

import * as Views from './views';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminDocumentTypeRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.DocumentTypeIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/document-type',
        alias: 'documentTypeAdmin',
      },
      multi: true,
    },
  ],
})
export class AdminDocumentTypeModule {}
