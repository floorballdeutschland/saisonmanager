import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        loadChildren: () =>
          import('@floorball/public/home').then((m) => m.PublicHomeModule),
      },

      {
        path: '',
        loadChildren: () =>
          import('@floorball/public/login').then((m) => m.PublicLoginModule),
      },
    ],
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/association/host').then(
        (m) => m.PublicAssociationHostModule
      ),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      paramsInheritanceStrategy: 'always',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
