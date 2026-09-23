import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: '**',
    component: Views.NotFoundComponent,
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicNotFoundRoutingModule {}
