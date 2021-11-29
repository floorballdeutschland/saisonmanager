import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  getItem(key: string): string {
    const item = localStorage.getItem(key);

    if (!item) return '';

    return item;
  }

  removeItem(key: string) {
    const item = localStorage.getItem(key);

    if (!item) return;

    if (item) {
      localStorage.removeItem(key);
    }
  }
}
