import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/**
 * Lädt Lazy-Module nur dann im Hintergrund vor, wenn ihre Route explizit
 * mit `data: { preload: true }` markiert ist – statt wie `PreloadAllModules`
 * *alle* Module (inkl. der vielen selten genutzten Admin-Bereiche) direkt
 * nach dem Start herunterzuladen. So bleibt die Bandbreite kurz nach dem
 * Start für die aktuell sichtbare (öffentliche) Ansicht frei, während die
 * häufig angesteuerten öffentlichen Bereiche weiterhin vorgeladen werden.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return route.data?.['preload'] === true ? load() : of(null);
  }
}
