import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { StreamThumbnailsModule } from '@floorball/stream-thumbnails';
import { PublicStreamThumbnailsRoutingModule } from './public-stream-thumbnails-routing.module';
import * as Views from './views';

/**
 * YouTube-Thumbnails der Spiele eines Spieltags, über das Overlay-Token und
 * ohne Anmeldung (feedback#77). Das Bedienfeld verlinkt hierher, statt die
 * Bilder selbst zu speichern: In einem OBS-Dock kann man keine Dateien
 * herunterladen, ein Link mit `target="_blank"` öffnet OBS dagegen im
 * normalen Browser.
 */
@NgModule({
  declarations: [Views.StreamThumbnailsComponent],
  imports: [
    CommonModule,
    TranslocoModule,
    StreamThumbnailsModule,
    PublicStreamThumbnailsRoutingModule,
  ],
})
export class PublicStreamThumbnailsModule {}
