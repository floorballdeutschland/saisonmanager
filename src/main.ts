import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { initSentry } from './app/_helpers/_utils/sentry-init';

// Vor dem Bootstrap, sonst entgehen Sentry die Fehler der Startphase. Ohne
// hinterlegten DSN tut der Aufruf nichts (#230).
initSentry();

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    applicationProviders: [provideZoneChangeDetection()],
  })
  .catch((err) => console.error(err));
