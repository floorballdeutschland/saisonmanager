import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';

@NgModule({
  declarations: [
    Molecules.SkeletonNextMatchItemComponent,
    Molecules.SkeletonMatchPairingComponent,
    Organisms.SkeletonNextMatchListComponent,
    Organisms.SkeletonMatchPairingListComponent,
    Organisms.SkeletonTableComponent,
  ],
  imports: [CommonModule],
  exports: [
    Organisms.SkeletonNextMatchListComponent,
    Organisms.SkeletonMatchPairingListComponent,
    Organisms.SkeletonTableComponent,
  ],
})
export class UikitLoadingSkeletonsModule {}
