import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { HighlightEditorComponent } from './highlight-editor.component';

/**
 * Kalibrierung und Highlight-Auswahl eines Tablet-Spiels (api#838). Ohne
 * Guard: Beim Mail-Link ist der Token die Berechtigung, beim Aufruf von der
 * Spielseite prüft die API Admin bzw. SBK.
 */
@NgModule({
  imports: [
    CommonModule,
    UikitCommonModule,
    RouterModule.forChild([
      {
        path: 'highlights/bearbeiten',
        pathMatch: 'full',
        component: HighlightEditorComponent,
        data: { scrollTop: true },
      },
    ]),
  ],
  declarations: [HighlightEditorComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'highlight-editor', alias: 'highlightEditor' },
      multi: true,
    },
  ],
})
export class PublicHighlightEditorModule {}
