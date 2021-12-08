import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';

@NgModule({
  declarations: [
    Molecules.SkeletonNextMatchItemComponent,
    Molecules.SkeletonMatchPairingComponent,
    Molecules.SkeletonMatchEncounterComponent,
    Organisms.SkeletonNextMatchListComponent,
    Organisms.SkeletonMatchPairingListComponent,
    Organisms.SkeletonTableComponent,
    Organisms.SkeletonMatchEncounterListComponent,
  ],
  imports: [CommonModule],
  exports: [
    Organisms.SkeletonNextMatchListComponent,
    Organisms.SkeletonMatchPairingListComponent,
    Organisms.SkeletonTableComponent,
    Organisms.SkeletonMatchEncounterListComponent,
  ],
})
export class UikitLoadingSkeletonsModule {}
