import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

/**
 * Lädt Übersetzungen aus statischen JSON-Dateien unter `/assets/i18n/`.
 * Für Scopes ruft Transloco den Loader mit dem Pfad `<scope>/<lang>` auf
 * (z. B. `admin/league/en` → `/assets/i18n/admin/league/en.json`).
 */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  constructor(private http: HttpClient) {}

  getTranslation(lang: string) {
    return this.http.get<Translation>(`/assets/i18n/${lang}.json`);
  }
}
