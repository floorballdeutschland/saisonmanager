import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Server-Variante des Transloco-Loaders für SSR/Prerendering.
 *
 * Der reguläre {@link TranslocoHttpLoader} lädt Übersetzungen per HTTP von
 * `/assets/i18n/...`. Beim Prerendering existiert kein HTTP-Server, der diese
 * Assets ausliefert – der HTTP-Request würde fehlschlagen und (über den
 * blockierenden `APP_INITIALIZER`) den Bootstrap der Seite abbrechen.
 *
 * Diese Variante liest die JSON-Dateien stattdessen direkt vom Dateisystem
 * aus den Quell-Assets. Fehlende Scope-Dateien werden tolerant als leeres
 * Objekt zurückgegeben.
 */
@Injectable()
export class TranslocoServerLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    try {
      const file = join(process.cwd(), 'src', 'assets', 'i18n', `${lang}.json`);
      return of(JSON.parse(readFileSync(file, 'utf-8')) as Translation);
    } catch {
      return of({});
    }
  }
}
