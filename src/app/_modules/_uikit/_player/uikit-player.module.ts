import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PlayerLineupItemComponent } from './components/organisms';
import * as Organisms from './components/organisms';
import { CurrentAgePipe, FullNamePipe, GenderPipe } from './pipes';
import * as Pipes from './pipes';
import { CdkTableModule } from '@angular/cdk/table';
import { IconsModule } from '../_icons/icons.module';

@NgModule({
  imports: [CommonModule, RouterModule, CdkTableModule, IconsModule],
  declarations: [
    Organisms.PlayerRankingTableComponent,
    Organisms.PlayerLineupItemComponent,
    Organisms.PlayerLineupDialogComponent,
    Pipes.CurrentAgePipe,
    Pipes.FullNamePipe,
    Pipes.GenderPipe,
  ],
  exports: [
    Organisms.PlayerRankingTableComponent,
    Organisms.PlayerLineupDialogComponent,
    PlayerLineupItemComponent,
    FullNamePipe,
    CurrentAgePipe,
    GenderPipe,
  ],
})
export class UikitPlayerModule {}
