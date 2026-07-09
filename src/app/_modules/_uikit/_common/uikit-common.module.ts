import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import {
  AwardTitlePipe,
  CompletedAwardsFilterPipe,
  HasStartingPlayerPipe,
  StartingPlayerPositionTitlePipe,
} from 'src/app/_helpers/_pipes';
import * as Atoms from './components/atoms';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';
import * as Pipes from './pipes';
import * as HelperPipes from 'src/app/_helpers/_pipes';
import { UikitShellModule } from './uikit-shell.module';

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    OverlayModule,
    FormsModule,
    TranslocoModule,
    // Eager geladene Shell-Komponenten (Sidebar, Notification, Navigationen,
    // Metanavigation, Logo, NormalizeLeagueRoutePipe). Hier nur importiert +
    // re-exportiert, damit Lazy-Feature-Module sie weiterhin auflösen.
    UikitShellModule,
  ],
  declarations: [
    Atoms.TabItemComponent,
    Atoms.ButtonComponent,
    Atoms.WhistleIconComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Molecules.PaginationComponent,
    Molecules.RefereeAutocompleteComponent,
    Organisms.ConfirmationDialogComponent,
    Organisms.ConfirmationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
    Pipes.GradientPipe,
    Pipes.NormalizeEventPipe,
    Pipes.NormalizeMatchResultPipe,
    Pipes.NormalizeRefereePipe,
    Pipes.RouteMergePipe,
    Pipes.ToNumberPipe,
    Pipes.FilterPeriodEventsPipe,
    Pipes.ReverseEventsPipe,
    Pipes.SumFieldPipe,
    Organisms.MobileHeaderComponent,
    HelperPipes.AdditionalClubFilterPipe,
    HelperPipes.AwardTitlePipe,
    HelperPipes.ClubPlayerLicensePipe,
    HelperPipes.CompletedAwardsFilterPipe,
    HelperPipes.CurrentPeriodPipe,
    HelperPipes.FinalRoundsPipe,
    HelperPipes.GameNoticeHeadlinePipe,
    HelperPipes.GameNoticeVisibilityPipe,
    HelperPipes.GameTimelineFilterPipe,
    HelperPipes.GroupIdentifierFilterPipe,
    HelperPipes.HasStartingPlayerPipe,
    HelperPipes.PeriodFilterPipe,
    HelperPipes.ReversePeriodsPipe,
    HelperPipes.SortPlayersPipe,
    HelperPipes.SortTrikotnumbersPipe,
    HelperPipes.StartingPlayerPositionTitlePipe,
    HelperPipes.TeamLineupPlayerPipe,
  ],
  exports: [
    TranslocoModule,
    // Re-Export der eager Shell-Komponenten/-Pipe für Lazy-Feature-Module.
    UikitShellModule,
    Atoms.TabItemComponent,
    Atoms.ButtonComponent,
    Atoms.WhistleIconComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Molecules.PaginationComponent,
    Molecules.RefereeAutocompleteComponent,
    Organisms.ConfirmationDialogComponent,
    Organisms.ConfirmationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
    Pipes.GradientPipe,
    Pipes.NormalizeEventPipe,
    Pipes.NormalizeMatchResultPipe,
    Pipes.NormalizeRefereePipe,
    Pipes.RouteMergePipe,
    Pipes.ToNumberPipe,
    Pipes.FilterPeriodEventsPipe,
    Pipes.ReverseEventsPipe,
    Pipes.SumFieldPipe,
    Organisms.MobileHeaderComponent,
    HelperPipes.AdditionalClubFilterPipe,
    HelperPipes.ClubPlayerLicensePipe,
    HelperPipes.CurrentPeriodPipe,
    HelperPipes.FinalRoundsPipe,
    HelperPipes.GameNoticeHeadlinePipe,
    HelperPipes.GameNoticeVisibilityPipe,
    HelperPipes.GameTimelineFilterPipe,
    HelperPipes.GroupIdentifierFilterPipe,
    HelperPipes.PeriodFilterPipe,
    HelperPipes.ReversePeriodsPipe,
    HelperPipes.SortPlayersPipe,
    HelperPipes.SortTrikotnumbersPipe,
    HelperPipes.TeamLineupPlayerPipe,
    StartingPlayerPositionTitlePipe,
    CompletedAwardsFilterPipe,
    AwardTitlePipe,
    HasStartingPlayerPipe,
  ],
})
export class UikitCommonModule {}
