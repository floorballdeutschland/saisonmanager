import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Atoms from './components/atoms';

@NgModule({
  imports: [CommonModule],
  declarations: [
    Atoms.LogoComponent,
  ],
  exports: [
    Atoms.LogoComponent,
  ],
})
export class UikitCommonModule {}
