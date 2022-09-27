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
    Atoms.ButtonComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Molecules.PaginationComponent,
    Organisms.LeagueNavigationComponent,
    Organisms.SidebarComponent,
    Organisms.NotificationComponent,
    Organisms.MetanavigationComponent,
    Organisms.FavoritesNavigationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
    Pipes.GradientPipe,
    Pipes.NormalizeEventPipe,
    Pipes.NormalizeMatchResultPipe,
    Pipes.NormalizeRefereePipe,
    Pipes.NormalizeLeagueRoutePipe,
    Pipes.RouteMergePipe,
    Pipes.ToNumberPipe,
    Pipes.MatchEventsPipe,
    Organisms.MobileHeaderComponent,
  ],
  exports: [
    Atoms.LogoComponent,
    Atoms.TabItemComponent,
    Atoms.ButtonComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Molecules.PaginationComponent,
    Organisms.LeagueNavigationComponent,
    Organisms.SidebarComponent,
    Organisms.NotificationComponent,
    Organisms.MetanavigationComponent,
    Organisms.FavoritesNavigationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
    Pipes.GradientPipe,
    Pipes.NormalizeEventPipe,
    Pipes.NormalizeMatchResultPipe,
    Pipes.NormalizeRefereePipe,
    Pipes.NormalizeLeagueRoutePipe,
    Pipes.RouteMergePipe,
    Pipes.ToNumberPipe,
    Pipes.MatchEventsPipe,
    Organisms.MobileHeaderComponent,
  ],
})
export class UikitCommonModule {}
