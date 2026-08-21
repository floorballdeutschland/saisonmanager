import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';

import * as Views from './views';

// Kein Routing-Modul und keine eigene Route mehr: Der Spielbetrieb wird als
// Abschnitt der Verbandsmaske gepflegt, nicht als eigener Menuepunkt. Das Modul
// ist damit ein reines Bausteinmodul, das die Verbandsverwaltung einbindet -- es
// bringt seinen Transloco-Scope mit, damit die Schluessel auch dort aufloesen
// (siehe referee-feedback-shared.module.ts, gleiches Muster).
@NgModule({
  imports: [CommonModule, FormsModule, UikitCommonModule],
  declarations: [Views.GameOperationSectionComponent],
  exports: [Views.GameOperationSectionComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: {
        scope: 'admin/game-operation',
        alias: 'gameOperationAdmin',
      },
      multi: true,
    },
  ],
})
export class AdminGameOperationModule {}
