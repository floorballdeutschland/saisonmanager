import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    // Einmal-Link aus der Bestätigungsmail an den Ausrichterverein. Bewusst ohne
    // Guard: Wer hier widerspricht, hat kein Benutzerkonto, der Token in
    // ?token=… ist die Berechtigung.
    path: 'spieltagscheckliste/einspruch/:gameId',
    component: Views.ChecklistVetoComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicChecklistVetoRoutingModule {}
