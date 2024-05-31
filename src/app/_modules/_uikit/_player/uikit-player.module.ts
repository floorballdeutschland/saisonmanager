import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PlayerLineupItemComponent } from './components/organisms';
import * as Organisms from './components/organisms';
import { CurrentAgePipe, FullNamePipe } from './pipes';
import * as Pipes from './pipes';
import { CdkTableModule } from '@angular/cdk/table';

@NgModule({
  imports: [CommonModule, CdkTableModule],
  declarations: [
    Organisms.PlayerRankingTableComponent,
    Organisms.PlayerLineupItemComponent,
    Organisms.PlayerLineupDialogComponent,
    Pipes.CurrentAgePipe,
    Pipes.FullNamePipe,
  ],
  exports: [
    Organisms.PlayerRankingTableComponent,
    Organisms.PlayerLineupDialogComponent,
    PlayerLineupItemComponent,
    FullNamePipe,
    CurrentAgePipe,
  ],
})
export class UikitPlayerModule {}
