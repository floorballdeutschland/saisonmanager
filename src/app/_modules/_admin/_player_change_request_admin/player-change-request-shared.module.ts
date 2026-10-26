import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import * as Views from './views';

/**
 * Die Liste der Spielerdaten-Korrekturen ohne Route, damit zwei Einstiege sie
 * teilen: die eigene Seite `/verwaltung/spieler-korrekturen` (Admin, SBK und
 * alte Lesezeichen) und der Reiter „Korrekturanträge" unter „Meine
 * Spieler*innen" (`@floorball/admin/player-vm`, fe#585).
 *
 * Der Transloco-Scope haengt hier und nicht an den aufrufenden Modulen: Die
 * Provider eines importierten Moduls landen im Injector des Lazy-Moduls, damit
 * loesen beide Wege dieselben Keys auf. Gleiches Muster wie
 * AdminPlayerStatsModule.
 */
@NgModule({
  imports: [CommonModule, FormsModule, RouterModule, UikitCommonModule],
  declarations: [Views.PlayerChangeRequestListComponent],
  exports: [Views.PlayerChangeRequestListComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/player-change-request',
        alias: 'playerChangeRequest',
      },
      multi: true,
    },
  ],
})
export class PlayerChangeRequestSharedModule {}
