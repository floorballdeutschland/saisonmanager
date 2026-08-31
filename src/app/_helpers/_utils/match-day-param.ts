import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

// Der gewählte Spieltag gehört in die Adresse, nicht nur in die Komponente.
// Übersicht bzw. Tabelle und das Einzelspiel sind Geschwister am selben
// Router-Outlet: Beim Klick auf ein Spiel wird die Listenansicht zerstört, ein
// Feld darin überlebt das nicht. Weil die Adresse der Liste bisher für jeden
// Spieltag dieselbe war, landete der Zurück-Weg (`Location.back()` im
// Spielbericht, ebenso der Zurück-Knopf des Browsers) auf einer Liste ohne
// Auswahl -- und die lud wieder `game_days/current`. Wer im August ein Spiel des
// 5. Spieltags aufschlug, kam auf dem 1. zurück.
//
// Der Zustand liegt damit an derselben Stelle wie bei der Lizenzverwaltung
// (`?spieler=`) und nicht in einem Dienst wie beim Saison-Switcher: Ein Spieltag
// gehört zu genau einer Adresse, ist damit verlinkbar und übersteht ein Neuladen.
export const MATCH_DAY_PARAM = 'spieltag';

// `undefined` heißt „nichts gewählt" und überlässt der API die Wahl
// (`game_days/current`). Eine von Hand verbogene Adresse darf keine Anfrage auf
// `spieltag=NaN` auslösen, ungültige Werte zählen deshalb wie „nichts gewählt".
export function matchDayFromParams(params: ParamMap): number | undefined {
  const raw = params.get(MATCH_DAY_PARAM);
  if (raw === null) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

// `replaceUrl`, damit jeder Klick auf zurück/weiter nicht einen weiteren
// Verlaufseintrag anlegt -- sonst müsste man sich durch alle durchgeklickten
// Spieltage zurückarbeiten. Der bestehende Eintrag wird umgeschrieben, der
// Zurück-Weg aus dem Spiel findet ihn also mit der Nummer vor.
//
// `null` entfernt den Parameter (Angular-Idiom bei `merge`). Beim Server-Rendern
// (Prerender) gibt es keine Adressleiste, dort bleibt der Aufruf ein No-op.
export function writeMatchDayToUrl(
  router: Router,
  route: ActivatedRoute,
  platformId: object,
  matchDay?: number
): void {
  if (!isPlatformBrowser(platformId)) {
    return;
  }

  router.navigate([], {
    relativeTo: route,
    queryParams: { [MATCH_DAY_PARAM]: matchDay ?? null },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
