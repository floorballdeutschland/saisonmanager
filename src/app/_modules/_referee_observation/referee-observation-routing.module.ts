import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { permissionGuard } from 'src/app/_helpers/_guards/permission.guard';
import * as Views from './views';

/**
 * Zwei getrennte Berechtigungen, deshalb je Route ein eigener Guard statt eines
 * gemeinsamen am Lazy-Einstieg: Beobachtungen SCHREIBEN darf nur, wer eine
 * gültige B-Zusatzqualifikation hat; die eigenen erhaltenen Rückmeldungen LESEN
 * darf jedes Konto mit Schiedsrichterprofil.
 */
const routes: Routes = [
  {
    path: 'schiedsrichter/meine-beobachtungen',
    pathMatch: 'full',
    component: Views.ObservationCoachIndexComponent,
    canActivate: [permissionGuard],
    data: { permission: 'menu_item_referee_observations', scrollTop: true },
  },
  {
    path: 'schiedsrichter/meine-beobachtungen/neu/:gameId',
    pathMatch: 'full',
    component: Views.ObservationFormComponent,
    canActivate: [permissionGuard],
    data: { permission: 'menu_item_referee_observations', scrollTop: true },
  },
  {
    path: 'schiedsrichter/beobachtungen',
    pathMatch: 'full',
    component: Views.ObservationReceivedComponent,
    canActivate: [permissionGuard],
    data: { permission: 'show_page_referee_observations', scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RefereeObservationRoutingModule {}
