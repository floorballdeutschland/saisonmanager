import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  // Beim Server-Rendering (SSR/Prerender) existiert kein localStorage.
  private get available(): boolean {
    return typeof localStorage !== 'undefined';
  }

  // Der Zugriff wirft auch dort, wo es localStorage gibt: privates Fenster,
  // per Browsereinstellung blockierte Website-Daten, volles Kontingent. Bisher
  // deckte der Dienst nur den SSR-Fall ab, eine Ausnahme aus dem Zugriff selbst
  // schlug bis in die aufrufende Komponente durch. Alles, was hier abgelegt
  // wird, ist eine Bequemlichkeit (zuletzt gewählte Ansicht, Favoriten) --
  // fällt der Speicher aus, muss die Seite trotzdem laufen.
  private guard<T>(fallback: T, operation: () => T): T {
    if (!this.available) return fallback;

    try {
      return operation();
    } catch {
      return fallback;
    }
  }

  setItem(key: string, value: string): void {
    this.guard(undefined, () => localStorage.setItem(key, value));
  }

  getItem(key: string): string {
    return this.guard('', () => localStorage.getItem(key) || '');
  }

  removeItem(key: string) {
    this.guard(undefined, () => localStorage.removeItem(key));
  }
}
