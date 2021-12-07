import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import * as Atoms from './components/atoms';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';
import * as Pipes from './pipes';

@NgModule({
  imports: [CommonModule, RouterModule],
  declarations: [
    Atoms.LogoComponent,
    Atoms.TabItemComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Organisms.LeagueNavigationComponent,
    Organisms.SidebarComponent,
    Organisms.MetanavigationComponent,
    Organisms.FavoritesNavigationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
    Pipes.GradientPipe,
    Pipes.NormalizeEventPipe,
    Pipes.NormalizeMatchResultPipe,
  ],
  exports: [
    Atoms.LogoComponent,
    Atoms.TabItemComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Organisms.LeagueNavigationComponent,
    Organisms.SidebarComponent,
    Organisms.MetanavigationComponent,
    Organisms.FavoritesNavigationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
    Pipes.GradientPipe,
    Pipes.NormalizeEventPipe,
    Pipes.NormalizeMatchResultPipe,
  ],
})
export class UikitCommonModule {}
