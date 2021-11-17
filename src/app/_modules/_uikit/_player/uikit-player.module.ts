import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Organisms from './components/organisms';

@NgModule({
  imports: [CommonModule],
  declarations: [Organisms.PlayerRankingTableComponent],
  exports: [Organisms.PlayerRankingTableComponent],
})
export class UikitPlayerModule {}
