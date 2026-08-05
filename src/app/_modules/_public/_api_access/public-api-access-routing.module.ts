import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    // Öffentliches Antragsformular. Bewusst ohne Guard: Antragsteller haben kein
    // Benutzerkonto.
    path: 'api-zugang',
    pathMatch: 'full',
    component: Views.ApiAccessRequestComponent,
    data: { scrollTop: true },
  },
  {
    path: 'api-zugang/nutzungsbedingungen',
    pathMatch: 'full',
    component: Views.ApiAccessTermsComponent,
    data: { scrollTop: true },
  },
  {
    // Einmal-Link aus der Freigabe-Mail; der Token steht als Query-Parameter.
    path: 'api-zugang/schluessel',
    pathMatch: 'full',
    component: Views.ApiAccessKeyRevealComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PublicApiAccessRoutingModule {}
