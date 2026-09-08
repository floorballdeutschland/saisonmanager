import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import * as Components from './_components';

/**
 * Der Stapel-Download der Livestream-Thumbnails als eigenes Modul, aus demselben
 * Grund wie bei den Overlay-Adressen: Der Knopf gehört an jede Ansicht, die
 * einen ganzen Spieltag zeigt -- heute den Spielplan der Verwaltung, und die
 * Sekretariatsseite eines Vereins wäre die nächste. Eine Komponente lässt sich
 * nur in einem Modul deklarieren; ohne dieses Modul stünde sie an der zweiten
 * Stelle als Kopie.
 */
@NgModule({
  declarations: [Components.ThumbnailBatchComponent],
  exports: [Components.ThumbnailBatchComponent],
  imports: [CommonModule],
})
export class StreamThumbnailsModule {}
