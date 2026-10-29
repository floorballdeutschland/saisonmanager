import { Provider } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ApiKeyInterceptor } from './api-key.interceptor';
import { CsrfInterceptor } from './csrf.interceptor';
import { SecretaryTokenInterceptor } from './secretary-token.interceptor';
import { ErrorInterceptor } from './error.interceptor';
import { PublicSessionInterceptor } from './public-session.interceptor';

/**
 * Die HTTP-Interceptoren der App in ihrer Reihenfolge. Der zuerst genannte
 * ist der äußerste; Antworten durchlaufen die Liste von hinten nach vorn.
 *
 * Als eigene Konstante, damit die Integrations-Spec
 * (http-interceptor-providers.spec.ts) genau diese Liste prüft und nicht eine
 * nachgebaute: Fehlt hier ein Eintrag oder kippt die Reihenfolge, bliebe die
 * öffentliche Seite leer, während jede Einzel-Spec grün ist.
 */
export const HTTP_INTERCEPTOR_PROVIDERS: Provider[] = [
  { provide: HTTP_INTERCEPTORS, useClass: ApiKeyInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: CsrfInterceptor, multi: true },
  {
    provide: HTTP_INTERCEPTORS,
    useClass: SecretaryTokenInterceptor,
    multi: true,
  },
  { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
  // Innerster, siehe PublicSessionInterceptor.
  {
    provide: HTTP_INTERCEPTORS,
    useClass: PublicSessionInterceptor,
    multi: true,
  },
];
