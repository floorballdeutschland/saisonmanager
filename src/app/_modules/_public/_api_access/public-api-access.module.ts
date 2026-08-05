import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TRANSLOCO_SCOPE, TranslocoModule } from '@jsverse/transloco';
import { PublicApiAccessRoutingModule } from './public-api-access-routing.module';

import * as Views from './views';

/**
 * Öffentlicher Antrag auf einen API-Zugang für Drittanbieter: Formular,
 * Volltext der Nutzungsvereinbarung und Abholseite für den genehmigten Key.
 * Alle drei Seiten sind ohne Anmeldung erreichbar.
 */
@NgModule({
  declarations: [
    Views.ApiAccessRequestComponent,
    Views.ApiAccessTermsComponent,
    Views.ApiAccessKeyRevealComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslocoModule,
    PublicApiAccessRoutingModule,
  ],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'api-access', alias: 'apiAccess' },
      multi: true,
    },
  ],
})
export class PublicApiAccessModule {}
