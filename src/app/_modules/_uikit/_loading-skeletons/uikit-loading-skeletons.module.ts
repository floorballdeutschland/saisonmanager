import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';

@NgModule({
  declarations: [
    Molecules.SkeletonNextMatchItemComponent,
    Organisms.SkeletonNextMatchListComponent,
  ],
  imports: [CommonModule],
  exports: [
    Molecules.SkeletonNextMatchItemComponent,
    Organisms.SkeletonNextMatchListComponent,
  ],
})
export class UikitLoadingSkeletonsModule {}
