import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';
import { RouterModule } from '@angular/router';
import { UikitCommonModule } from '@floorball/uikit/common';
import { MatchEventButtonComponent } from './components/organisms';
import { FormsModule } from '@angular/forms';
import { SortTrikotnumbersPipe } from '../../../_helpers/_pipes/sort-trikotnumbers.pipe';
import {
  GameNoticeHeadlinePipe,
  GameNoticeVisibilityPipe,
} from '../../../_helpers';
import { PeriodFilterPipe } from 'src/app/_helpers/_pipes/period-filter.pipe';

@NgModule({
  imports: [CommonModule, RouterModule, UikitCommonModule, FormsModule],
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
    Organisms.MatchEventButtonComponent,
    SortTrikotnumbersPipe,
    GameNoticeHeadlinePipe,
    GameNoticeVisibilityPipe,
  ],
  exports: [
    Organisms.MatchPairingListComponent,
    Organisms.MatchEncounterListComponent,
    Organisms.MatchInfoComponent,
    Organisms.NextMatchListComponent,
    Organisms.MatchHistoryComponent,
    Organisms.MatchHeaderComponent,
    MatchEventButtonComponent,
    SortTrikotnumbersPipe,
  ],
})
export class UikitMatchesModule {}
