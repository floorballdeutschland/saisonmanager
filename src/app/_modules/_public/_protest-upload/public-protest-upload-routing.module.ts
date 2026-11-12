import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    // Link aus der Mail an eine Protestpartei. Bewusst ohne Guard: Der Token
    // ist die Berechtigung, ein Benutzerkonto gibt es dazu nicht.
    path: 'protest/:token',
    component: Views.ProtestUploadComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicProtestUploadRoutingModule {}
