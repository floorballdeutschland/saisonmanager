import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { OverlayLinksModule } from '@floorball/overlay-links';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AccessCardModule } from '@floorball/access-card';
import { StreamThumbnailsModule } from '@floorball/stream-thumbnails';

import * as Views from './views';

/**
 * Zugang fuer das Spielsekretariat, ohne eigene Route: Die Seite ist ein
 * Reiter von „Spieltagsaufgaben" (`@floorball/club-game-day`, fe#586).
 */
@NgModule({
  imports: [
    CommonModule,
    UikitCommonModule,
    OverlayLinksModule,
    AccessCardModule,
    StreamThumbnailsModule,
  ],
  declarations: [Views.SecretaryLinksComponent],
  exports: [Views.SecretaryLinksComponent],
})
export class SecretaryLinksModule {}
