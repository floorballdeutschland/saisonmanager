import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Components from './_components';

/**
 * Der Abschnitt „Livestream-Overlays" als eigenes Modul, weil ihn zwei
 * unabhängige Bereiche brauchen: der Spielbericht (Begrüßung und Schritt 1)
 * und die Seite „Spielsekretariat", auf der der Verein seine Zugangslinks
 * ausgibt. Eine Komponente lässt sich nur in einem Modul deklarieren – ohne
 * dieses Modul stünde sie an der zweiten Stelle als Kopie.
 */
@NgModule({
  declarations: [Components.OverlayLinksComponent],
  exports: [Components.OverlayLinksComponent],
  imports: [CommonModule, UikitCommonModule],
})
export class OverlayLinksModule {}
