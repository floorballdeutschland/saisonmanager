import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'lizenzcheck',
    component: Views.LizenzcheckComponent,
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicRefereeLicenseRoutingModule {}
