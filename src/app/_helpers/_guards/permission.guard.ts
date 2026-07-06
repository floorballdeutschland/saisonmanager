import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { SessionService } from '@floorball/core';

/**
 * Datengetriebener Berechtigungs-Guard für die geschützten `/verwaltung`-Routen.
 *
 * Konsistenz zum Menü: Der Guard liest dieselben Permission-Schlüssel, die auch
 * die Metanavigation über `showItem('menu_item_...')` auswertet – aus derselben
 * (persistierten) User-Quelle. Eine Route, die das Menü anzeigt, ist damit
 * erreichbar; eine Route, die das Menü verbirgt, leitet sauber um, statt die
 * Komponente zu rendern und zum Scheitern verurteilte Admin-API-Calls
 * abzufeuern (die sonst 401/403 + blockierende Fehler-Popups auslösen).
 *
 * Der Guard ist reine UX-/Defense-in-Depth-Maßnahme – die eigentliche
 * Autorisierung erzwingt weiterhin der Server.
 *
 * Erwartet in `route.data`:
 *   `permission`: ein Schlüssel (`string`) oder mehrere (`string[]`, ODER-Logik).
 */
export const permissionGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const session = inject(SessionService);
  const router = inject(Router);

  const user = session.currentUserValue;

  // Nicht eingeloggt → zum Login mit returnUrl, damit nach Anmeldung
  // wieder zur ursprünglich angefragten Seite gesprungen werden kann.
  if (!user) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  const required = route.data['permission'] as string | string[] | undefined;

  // Keine Permission-Angabe: reine Login-Pflicht (bereits erfüllt).
  if (!required) {
    return true;
  }

  const keys = Array.isArray(required) ? required : [required];
  const allowed = keys.some((key) => !!user.permissions?.[key]);

  // Fehlende Berechtigung → still zur Startseite umleiten (kein Render,
  // kein API-Call, kein Fehler-Popup).
  return allowed ? true : router.createUrlTree(['/']);
};
