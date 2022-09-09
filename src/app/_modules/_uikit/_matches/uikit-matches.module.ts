import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { MatchEventButtonComponent } from './components/organisms';

@NgModule({
  imports: [CommonModule, RouterModule, UikitCommonModule],
  declarations: [
    Molecules.MatchPairingComponent,
    Molecules.MatchEncounterComponent,
    Molecules.NextMatchItemComponent,
    Molecules.MatchHistoryItemComponent,
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
    Organisms.MatchInfoComponent,
    Organisms.NextMatchListComponent,
    Organisms.MatchHistoryComponent,
    Organisms.MatchHeaderComponent,
    Organisms.MatchEventFormComponent,
    Organisms.MatchEventButtonComponent,
  ],
  exports: [
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
    Organisms.MatchInfoComponent,
    Organisms.NextMatchListComponent,
    Organisms.MatchHistoryComponent,
    Organisms.MatchHeaderComponent,
    Organisms.MatchEventFormComponent,
    MatchEventButtonComponent,
  ],
})
export class UikitMatchesModule {}
