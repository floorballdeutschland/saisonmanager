import {
  HTTP_INTERCEPTORS,
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

import { TranslocoModule } from '@jsverse/transloco';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { UikitCommonModule } from '@floorball/uikit/common';
import { provideTranslocoRoot, readInitialLang } from '@floorball/core';
import { SessionService } from './_modules/_core/_services';
import { ErrorInterceptor } from './_helpers/_interceptors/error.interceptor';
import { ApiKeyInterceptor } from './_helpers/_interceptors/api-key.interceptor';
import { SecretaryTokenInterceptor } from './_helpers/_interceptors/secretary-token.interceptor';
import { CsrfInterceptor } from './_helpers/_interceptors/csrf.interceptor';

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    UikitCommonModule,
    TranslocoModule,
  ],
  providers: [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: false,
      }),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    { provide: HTTP_INTERCEPTORS, useClass: ApiKeyInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: CsrfInterceptor, multi: true },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: SecretaryTokenInterceptor,
      multi: true,
    },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
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
