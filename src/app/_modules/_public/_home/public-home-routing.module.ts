import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: Views.HomeComponent,
    data: {
      scrollTop: true,
    },
  },
  // Just temporary to test components. TODO Delete when unnecessary
  {
    path: 'styleguide',
    pathMatch: 'full',
    component: Views.StyleguideComponent,
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicHomeRoutingModule {}
