import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TRANSLOCO_SCOPE, TranslocoModule } from '@jsverse/transloco';

import * as Components from './_components';

/**
 * Der Stapel-Download der Livestream-Thumbnails als eigenes Modul, aus demselben
 * Grund wie bei den Overlay-Adressen: Der Knopf gehört an jede Ansicht, die
 * mehrere Spiele zeigt -- den Spielplan der Verwaltung, die Sekretariatsseite
 * des Vereins (Saisonstapel) und die Thumbnail-Seite hinter dem
 * OBS-Bedienfeld. Eine Komponente lässt sich nur in einem Modul deklarieren;
 * ohne dieses Modul stünde sie an der zweiten Stelle als Kopie.
 *
 * Der Transloco-Scope hängt hier und nicht an den aufrufenden Modulen, wie
 * beim Schiri-Feedback: Die Provider eines importierten Moduls landen im
 * Injector des jeweiligen Lazy-Moduls, damit lösen alle Einsatzorte die Keys
 * auf.
 */
@NgModule({
  declarations: [
    Components.ThumbnailBatchComponent,
    Components.SeasonThumbnailsComponent,
  ],
  exports: [
    Components.ThumbnailBatchComponent,
    Components.SeasonThumbnailsComponent,
  ],
  imports: [CommonModule, TranslocoModule],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'stream-thumbnails', alias: 'streamThumbnails' },
      multi: true,
    },
  ],
})
export class StreamThumbnailsModule {}
