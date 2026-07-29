import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    // Persönlicher Einmal-Link aus der Einladungsmail. Bewusst ohne Guard: Wer
    // hier abgibt, hat kein Benutzerkonto, der Token ist die Berechtigung.
    path: 'schiri-feedback/abgeben/:token',
    component: Views.RefereeFeedbackSubmitComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicRefereeFeedbackRoutingModule {}
