import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AccountRoutingModule } from './account-routing.module';

import * as Views from './views';

@NgModule({
  imports: [CommonModule, FormsModule, AccountRoutingModule, UikitCommonModule],
  declarations: [Views.AccountComponent],
})
export class AccountModule {}
