import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';

@NgModule({
  imports: [CommonModule],
  declarations: [
    Molecules.MatchPairingComponent,
    Molecules.MatchEncounterComponent,
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
  ],
  exports: [
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
  ],
})
export class UikitMatchesModule {}
