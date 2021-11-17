import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './views';

const routes: Routes = [
  {
    path: 'overview',
    component: Views.OverviewComponent,
    data: {
      scrollTop: true,
    },
  },
];

@NgModule({
  declarations: [Views.OverviewComponent],
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicOverviewRoutingModule {}
