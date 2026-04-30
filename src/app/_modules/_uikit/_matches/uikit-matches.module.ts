import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';
import { MatchEventButtonComponent } from './components/organisms';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { FormsModule } from '@angular/forms';
import { MatchTimelineItemComponent } from './components/molecules';
import { MatchEventFormModule } from 'src/app/_modules/_public/_association/_match-report/_components/match-event-form/match-event-form.module';

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    UikitCommonModule,
    FormsModule,
    MatchEventFormModule,
  ],
  declarations: [
    Molecules.MatchPairingComponent,
    Molecules.MatchEncounterComponent,
    Molecules.NextMatchItemComponent,
    Molecules.MatchHistoryItemComponent,
    Molecules.MatchTimelineItemComponent,
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
    Organisms.MatchInfoComponent,
    Organisms.NextMatchListComponent,
    Organisms.MatchHistoryComponent,
    Organisms.MatchHeaderComponent,
    Organisms.MatchEventButtonComponent,
  ],
  exports: [
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
    Organisms.MatchInfoComponent,
    Organisms.NextMatchListComponent,
    Organisms.MatchHistoryComponent,
    Organisms.MatchHeaderComponent,
    MatchEventButtonComponent,
    MatchTimelineItemComponent,
  ],
})
export class UikitMatchesModule {}
