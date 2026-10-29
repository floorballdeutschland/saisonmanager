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
 * Der API-Key wird nicht per Platzhalter in den Code geschrieben, sondern im
 * Prerender-Worker aus `process.env` gelesen, damit er in keiner
 * ausgelieferten Datei landet. `build-deploy.sh` setzt die Variable und
 * prüft nach dem Build, dass der Key nirgends in der Ausgabe steht.
 *
 * Fehlt die Variable, bricht das Rendern ab. Ohne Key lieferte die API jedem
 * Abruf ein 401, und Seiten, deren Komponenten den Fehler selbst abfangen,
 * würden still leer vorgerendert.
 */
@NgModule({
  imports: [AppModule, ServerModule],
  providers: [
    { provide: TRANSLOCO_LOADER, useClass: TranslocoServerLoader },
    {
      provide: PRERENDER_API_KEY,
      useFactory: () => {
        const key = process.env['PRERENDER_API_KEY'];
        if (!key) {
          throw new Error(
            'PRERENDER_API_KEY fehlt. Vorrendern nur über build-deploy.sh.'
          );
        }
        return key;
      },
    },
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}
