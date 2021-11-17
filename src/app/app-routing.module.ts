import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/home').then((m) => m.PublicHomeModule),
  },
  {
    path: '',
    loadChildren: () =>
      import('@floorball/public/overview').then((m) => m.PublicOverviewModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
