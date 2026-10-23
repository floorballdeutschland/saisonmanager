import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as Views from './views';

const routes: Routes = [
  {
    // Geöffnet aus dem OBS-Bedienfeld (overlay/dock.html) mit dessen Token.
    // Ohne Guard: Das Overlay-Token in ?token=… ist die Berechtigung.
    path: 'livestream-thumbnails',
    component: Views.StreamThumbnailsComponent,
    data: { scrollTop: true },
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [RouterModule.forChild(routes)],
})
export class PublicStreamThumbnailsRoutingModule {}
