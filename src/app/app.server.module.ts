import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';
import { TRANSLOCO_LOADER } from '@jsverse/transloco';

import { AppModule } from './app.module';
import { AppComponent } from './app.component';
import { TranslocoServerLoader } from './_modules/_core/_i18n/transloco-server-loader';
import { PRERENDER_API_KEY } from './_helpers/_interceptors/api-key.interceptor';

/**
 * Server-Modul für SSR/Prerendering (SSG) der öffentlichen Seiten.
 *
 * Importiert das reguläre {@link AppModule} und ergänzt es um die
 * Server-Plattform ({@link ServerModule}). Der Transloco-Loader wird auf die
 * Dateisystem-Variante umgestellt, damit der Bootstrap beim Prerendering nicht
 * an HTTP-Requests für Übersetzungen scheitert.
 *
 * Der API-Key wird zur Laufzeit des Renderns aus der Umgebung gelesen und
 * nicht beim Build eingesetzt, damit er in keiner Datei landet, die
 * ausgeliefert wird. `build-deploy.sh` prüft das nach dem Build.
 */
@NgModule({
  imports: [AppModule, ServerModule],
  providers: [
    { provide: TRANSLOCO_LOADER, useClass: TranslocoServerLoader },
    {
      provide: PRERENDER_API_KEY,
      useFactory: () => process.env['PRERENDER_API_KEY'] ?? '',
    },
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}
