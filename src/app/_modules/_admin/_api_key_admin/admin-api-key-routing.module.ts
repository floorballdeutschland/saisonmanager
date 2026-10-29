import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/api-keys',
    pathMatch: 'full',
    component: Views.ApiKeyIndexComponent,
    data: { scrollTop: true },
  },
  {
    // Anträge Außenstehender auf einen Zugang. Gleiche Berechtigung wie die
    // Key-Liste, deshalb kein eigener Menüpunkt und kein weiterer Permission-Key.
    path: 'verwaltung/api-keys/antraege',
    pathMatch: 'full',
    component: Views.ApiKeyApplicationIndexComponent,
    data: { scrollTop: true },
  },
  {
    // Zugriffe der Website-Besucher ohne Anmeldung (anonyme Sitzung), dieselbe
    // Ansicht wie für einen Key. Vor ':id/nutzung', sonst hielte der Router
    // 'website' für eine Key-Id.
    path: 'verwaltung/api-keys/website/nutzung',
    pathMatch: 'full',
    component: Views.ApiKeyUsageComponent,
    data: { scrollTop: true, publicUsage: true },
  },
  {
    // Muss nach 'antraege' stehen, sonst schluckt :id das Segment.
    path: 'verwaltung/api-keys/:id/nutzung',
    pathMatch: 'full',
    component: Views.ApiKeyUsageComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminApiKeyRoutingModule {}
