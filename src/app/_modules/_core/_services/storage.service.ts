import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  // Beim Server-Rendering (SSR/Prerender) existiert kein localStorage.
  private get available(): boolean {
    return typeof localStorage !== 'undefined';
  }

  setItem(key: string, value: string): void {
    if (!this.available) return;
    localStorage.setItem(key, value);
  }

  getItem(key: string): string {
    if (!this.available) return '';
    const item = localStorage.getItem(key);

    if (!item) return '';

    return item;
  }

  removeItem(key: string) {
    if (!this.available) return;
    const item = localStorage.getItem(key);

    if (!item) return;

    if (item) {
      localStorage.removeItem(key);
    }
  }
}
