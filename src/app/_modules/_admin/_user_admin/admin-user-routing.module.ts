import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/benutzer',
    pathMatch: 'full',
    component: Views.UserIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/benutzer/neu',
    pathMatch: 'full',
    component: Views.UserCreateComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/benutzer/:id/bearbeiten',
    pathMatch: 'full',
    component: Views.UserEditComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminUserRoutingModule {}
