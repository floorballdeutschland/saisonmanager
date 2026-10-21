import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';

import { TabletCaptureComponent } from './tablet-capture.component';
import { TabletFeedbackComponent } from './tablet-feedback.component';

/**
 * Tabletmodus der Spielberichtseingabe (Beta, fe#344).
 *
 * Der Scope hängt hier und nicht am Spielbericht-Modul: Dessen Ansichten
 * (Schalter in Schritt 2, Abschlussfrage) nutzen dieselben Texte, und die
 * Provider eines importierten Moduls landen im Injector des Lazy-Moduls der
 * Spielseite. So reicht ein Scope für alle Stellen.
 */
@NgModule({
  imports: [CommonModule, FormsModule, UikitCommonModule],
  declarations: [TabletCaptureComponent, TabletFeedbackComponent],
  exports: [TabletCaptureComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'match-report-tablet', alias: 'tablet' },
      multi: true,
    },
  ],
})
export class TabletCaptureModule {}
