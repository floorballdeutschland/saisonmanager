import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PeriodFilterPipe } from 'src/app/_helpers/_pipes/period-filter.pipe';
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
    Atoms.WhistleIconComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Molecules.PaginationComponent,
    Organisms.ConfirmationDialogComponent,
    Organisms.ConfirmationComponent,
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
    PeriodFilterPipe,
  ],
  exports: [
    Atoms.LogoComponent,
    Atoms.TabItemComponent,
    Atoms.ButtonComponent,
    Atoms.WhistleIconComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Molecules.PaginationComponent,
    Organisms.ConfirmationDialogComponent,
    Organisms.ConfirmationComponent,
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
    PeriodFilterPipe,
  ],
})
export class UikitCommonModule {}
