import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    path: 'verwaltung/schiri-feedback-kommentare',
    pathMatch: 'full',
    component: Views.FeedbackCommentsIndexComponent,
    data: { scrollTop: true },
  },
  {
    path: 'verwaltung/schiri-feedback-kommentare/themen',
    pathMatch: 'full',
    component: Views.FeedbackThemesComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminFeedbackCommentsRoutingModule {}
