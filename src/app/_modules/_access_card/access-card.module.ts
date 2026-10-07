import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UikitCommonModule } from '@floorball/uikit/common';

import { AccessCardComponent } from './access-card.component';

/**
 * Zugang als QR-Code zum Ausdrucken. Eigenes Modul, weil ihn zwei getrennte
 * Bereiche zeigen: die Sekretariatsseite (Code fürs Spielsekretariat) und der
 * Abschnitt Livestream-Overlays, der zusätzlich im Spielbericht steht.
 */
@NgModule({
  declarations: [AccessCardComponent],
  exports: [AccessCardComponent],
  imports: [CommonModule, UikitCommonModule],
})
export class AccessCardModule {}
