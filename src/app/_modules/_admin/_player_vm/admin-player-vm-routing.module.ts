import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlayerStatisticsComponent } from '@floorball/admin/player-stats';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/spieler-verein',
    pathMatch: 'full',
    component: Views.PlayerVmIndexComponent,
    data: { scrollTop: true },
  },
  {
    // Rangliste der Spieler dieses Vereins. Kein eigener Menuepunkt und kein
    // eigenes Gate: Wer die Vereins-Spielerliste sehen darf, sieht auch ihre
    // Auswertung; ueber den Verein selbst entscheidet die API (403).
    path: 'verwaltung/spieler-verein/:clubId/spielerdaten',
    pathMatch: 'full',
    component: PlayerStatisticsComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminPlayerVmRoutingModule {}
