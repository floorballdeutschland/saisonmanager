import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import { SecretaryLinksRoutingModule } from './secretary-links-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, SecretaryLinksRoutingModule, UikitCommonModule],
  declarations: [Views.SecretaryLinksComponent],
})
export class SecretaryLinksModule {}
