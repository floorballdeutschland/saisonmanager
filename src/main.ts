import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// import * as Sentry from '@sentry/angular';
// import { BrowserTracing } from '@sentry/tracing';

// Sentry.init({
//   dsn: 'https://68070f7ec5fe4ea0920b43c46893c759@o1082542.ingest.sentry.io/6092803',
//   integrations: [
//     new BrowserTracing({
//       tracingOrigins: ['localhost', 'https://saisonmanager.org'],
//       routingInstrumentation: Sentry.routingInstrumentation,
//     }),
//   ],

//   // Set tracesSampleRate to 1.0 to capture 100%
//   // of transactions for performance monitoring.
//   // We recommend adjusting this value in production
//   tracesSampleRate: 0.3,
// });

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    applicationProviders: [provideZoneChangeDetection()],
  })
  .catch((err) => console.error(err));
