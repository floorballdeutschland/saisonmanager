import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import * as Atoms from './components/atoms';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';
import * as Pipes from './pipes';

@NgModule({
  imports: [CommonModule, RouterModule, OverlayModule],
  declarations: [
    Atoms.LogoComponent,
    Atoms.TabItemComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Molecules.PaginationComponent,
    Organisms.LeagueNavigationComponent,
    Organisms.SidebarComponent,
    Organisms.MetanavigationComponent,
    Organisms.FavoritesNavigationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
    Pipes.GradientPipe,
    Pipes.NormalizeEventPipe,
    Pipes.NormalizeMatchResultPipe,
    Pipes.RouteMergePipe,
    Organisms.MobileHeaderComponent,
  ],
  exports: [
    Atoms.LogoComponent,
    Atoms.TabItemComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Molecules.PaginationComponent,
    Organisms.LeagueNavigationComponent,
    Organisms.SidebarComponent,
    Organisms.MetanavigationComponent,
    Organisms.FavoritesNavigationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
    Pipes.GradientPipe,
    Pipes.NormalizeEventPipe,
    Pipes.NormalizeMatchResultPipe,
    Pipes.RouteMergePipe,
    Organisms.MobileHeaderComponent,
  ],
})
export class UikitCommonModule {}
