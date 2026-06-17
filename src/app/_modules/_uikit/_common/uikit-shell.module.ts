import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LogoComponent } from './components/atoms/logo/logo.component';
import { SidebarComponent } from './components/organisms/sidebar/sidebar.component';
import { NotificationComponent } from './components/organisms/notification/notification.component';
import { LeagueNavigationComponent } from './components/organisms/league-navigation/league-navigation.component';
import { FavoritesNavigationComponent } from './components/organisms/favorites-navigation/favorites-navigation.component';
import { MetanavigationComponent } from './components/organisms/metanavigation/metanavigation.component';
import { NormalizeLeagueRoutePipe } from './pipes/normalize-league-route.pipe';

// Eager geladenes App-Shell-Modul: enthält ausschließlich die Layout-Komponenten,
// die AppComponent direkt rendert (Sidebar, Notification, League-/Favorites-
// Navigation) plus deren interne Abhängigkeiten (Metanavigation, Logo,
// NormalizeLeagueRoutePipe). Bewusst KEINE FormsModule-/CDK-Importe und keine
// Feature-Komponenten – die bleiben in UikitCommonModule und damit aus dem
// Initial-Bundle heraus (UikitCommonModule importiert dieses Modul und re-
// exportiert es, sodass Lazy-Feature-Module weiterhin alles auflösen).
//
// Wichtig: Komponenten/Pipes hier direkt aus ihren Dateien importieren – NICHT
// über die ./components/* Barrels. Ein `import * as Organisms` würde sonst auch
// Header/MobileHeader/SimilarLeagues u. a. mit ins Initial-Bundle ziehen.
@NgModule({
  imports: [CommonModule, RouterModule, TranslocoModule],
  declarations: [
    LogoComponent,
    SidebarComponent,
    NotificationComponent,
    LeagueNavigationComponent,
    FavoritesNavigationComponent,
    MetanavigationComponent,
    NormalizeLeagueRoutePipe,
  ],
  exports: [
    TranslocoModule,
    LogoComponent,
    SidebarComponent,
    NotificationComponent,
    LeagueNavigationComponent,
    FavoritesNavigationComponent,
    MetanavigationComponent,
    NormalizeLeagueRoutePipe,
  ],
})
export class UikitShellModule {}
