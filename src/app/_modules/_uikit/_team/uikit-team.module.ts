import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Organisms from './components/organisms';
import { CdkTableModule } from '@angular/cdk/table';

@NgModule({
  imports: [CommonModule, CdkTableModule],
  declarations: [Organisms.TeamRankingTableComponent],
  exports: [Organisms.TeamRankingTableComponent],
})
export class UikitTeamModule {}
