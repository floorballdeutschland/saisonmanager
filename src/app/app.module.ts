import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXsrfConfiguration,
  withXhr,
} from '@angular/common/http';
import {
  APP_INITIALIZER,
  ErrorHandler,
  LOCALE_ID,
  NgModule,
} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { Router } from '@angular/router';
import * as Sentry from '@sentry/angular';
import { FilteringErrorHandler } from './_helpers/_utils/filtering-error-handler';

import { TranslocoModule } from '@jsverse/transloco';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
// Direkt aus der Datei importieren (nicht über das Barrel @floorball/uikit/common),
// damit das eager geladene AppModule NICHT die UikitCommonModule mitzieht – sonst
// landen FormsModule/CDK/alle Feature-Komponenten wieder im Initial-Bundle.
import { UikitShellModule } from './_modules/_uikit/_common/uikit-shell.module';
import { provideTranslocoRoot, readInitialLang } from '@floorball/core';
import { SessionService } from './_modules/_core/_services';
import { HTTP_INTERCEPTOR_PROVIDERS } from './_helpers/_interceptors/http-interceptor-providers';

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [BrowserModule, AppRoutingModule, UikitShellModule, TranslocoModule],
  providers: [
    {
      // Sentrys Handler, aber mit einem Filter davor: Netzabbrüche und
      // „nicht angemeldet" sind bereits behandelt und brauchen keine Meldung.
      // Der Filter kann nicht in beforeSend sitzen, dort ist die
      // HttpErrorResponse schon zu einer Zeichenkette geworden – Begründung an
      // FilteringErrorHandler.
      provide: ErrorHandler,
      useValue: new FilteringErrorHandler(),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    ...HTTP_INTERCEPTOR_PROVIDERS,
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
    SessionService,
    ...provideTranslocoRoot(),
    // Sprache der Angular-Pipes (date/number/currency) folgt der persistierten
    // Oberflächensprache. LOCALE_ID kann nicht zur Laufzeit wechseln; der
    // SessionService lädt die Seite beim Sprachwechsel neu, sodass diese
    // Factory die neue Sprache übernimmt.
    { provide: LOCALE_ID, useFactory: readInitialLang },
    provideHttpClient(
      withXhr(),
      withInterceptorsFromDi(),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-CSRF-Token',
      })
    ),
  ],
})
export class AppModule {}
