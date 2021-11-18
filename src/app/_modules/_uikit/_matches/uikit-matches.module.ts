import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Molecules from './components/molecules';

@NgModule({
  imports: [CommonModule],
  declarations: [Molecules.MatchPairingComponent],
  exports: [Molecules.MatchPairingComponent],
})
export class UikitMatchesModule {}
