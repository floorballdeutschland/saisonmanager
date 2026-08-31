import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Views from './views';

/**
 * Die Spielerdaten-Rangliste als eigenes Modul, damit beide Einstiege sie
 * teilen: die Vereins-Spielerliste (`@floorball/admin/player-vm`) und die
 * Spielersuche des Verbands (`@floorball/admin/player`).
 *
 * Bewusst KEIN eigenes Lazy-Modul mit eigener Route in `app-routing.module.ts`:
 * Die Ansicht haengt an denselben Rollen wie ihr jeweiliger Einstieg, die
 * Routen liegen deshalb in den beiden Modulen. `spieler-verein/:clubId/
 * spielerdaten` erbt das Gate der Lazy-Route (`menu_item_player_vm`),
 * `spieler/spielerdaten` setzt wie alle Kindrouten von `_player_admin` sein
 * eigenes (`menu_item_player_admin`) -- dort sitzt kein Gate am Modul. Das
 * spart einen dritten Permission-Key, den niemand pflegen wuerde.
 *
 * Der Transloco-Scope haengt hier und nicht an den aufrufenden Modulen: Die
 * Provider eines importierten Moduls landen im Injector des Lazy-Moduls, damit
 * loesen beide Wege dieselben Keys auf.
 */
@NgModule({
  imports: [CommonModule, FormsModule, RouterModule, UikitCommonModule],
  declarations: [Views.PlayerStatisticsComponent],
  exports: [Views.PlayerStatisticsComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/player-stats', alias: 'playerStats' },
      multi: true,
    },
  ],
})
export class AdminPlayerStatsModule {}
