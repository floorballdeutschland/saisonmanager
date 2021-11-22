import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import * as Atoms from './components/atoms';
import * as Molecules from './components/molecules';
import * as Organisms from './components/organisms';

@NgModule({
  imports: [CommonModule],
  declarations: [
    Atoms.LogoComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Organisms.LeagueNavigationComponent,
    Organisms.SidebarComponent,
    Organisms.MetanavigationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
  ],
  exports: [
    Atoms.LogoComponent,
    Molecules.MatchDayComponent,
    Molecules.OperationComponent,
    Organisms.LeagueNavigationComponent,
    Organisms.SidebarComponent,
    Organisms.MetanavigationComponent,
    Organisms.HeaderComponent,
    Organisms.SimilarLeaguesComponent,
  ],
})
export class UikitCommonModule {}
