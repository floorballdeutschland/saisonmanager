import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Atoms from './components/atoms';
import * as Organisms from './components/organisms';

@NgModule({
  imports: [CommonModule],
  declarations: [
    Atoms.LogoComponent,
    Organisms.LeagueNavigationComponent
  ],
  exports: [
    Atoms.LogoComponent,
    Organisms.LeagueNavigationComponent
  ],
})
export class UikitCommonModule {}
