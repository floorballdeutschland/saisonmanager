import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';

@NgModule({
  imports: [CommonModule],
  declarations: [
    Molecules.MatchPairingComponent,
    Molecules.MatchEncounterComponent,
    Molecules.NextMatchItemComponent,
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
    Organisms.MatchInfoComponent,
    Organisms.NextMatchListComponent,
  ],
  exports: [
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
    Organisms.MatchInfoComponent,
    Organisms.NextMatchListComponent,
  ],
})
export class UikitMatchesModule {}
