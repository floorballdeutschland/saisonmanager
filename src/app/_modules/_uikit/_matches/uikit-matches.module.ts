import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';

@NgModule({
  imports: [CommonModule],
  declarations: [
    Molecules.MatchPairingComponent,
    Organisms.MatchPairingListComponent,
  ],
  exports: [Organisms.MatchPairingListComponent],
})
export class UikitMatchesModule {}
