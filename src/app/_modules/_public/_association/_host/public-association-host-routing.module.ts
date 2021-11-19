import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import * as Views from './_views';

const routes: Routes = [
  {
    path: ':association',
    component: Views.AssociationHostComponent,
    data: {
      scrollTop: true,
    },
    children: [
      {
        path: '',
        loadChildren: () =>
          import('@floorball/public/association/overview').then(
            (m) => m.PublicAssociationOverviewModule
          ),
      },
    ],
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicAssociationHostRoutingModule {}
