import { isPlatformBrowser, Location } from '@angular/common';
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

// Bewusst `Location.replaceState` und NICHT `Router.navigate`, obwohl der Router
// die Adresse ebenso umschreiben könnte.
//
// Die Anwendung läuft mit `scrollPositionRestoration: 'top'`
// (`app-routing.module.ts`). Der RouterScroller springt bei JEDER Navigation, die
// nicht von `popstate` kommt, auf `[0, 0]` -- `replaceUrl` und „nur der
// Abfrageteil hat sich geändert" ändern daran nichts, es genügt ein
// `NavigationEnd`. Und eine Navigation auf dieselbe Adresse meldet
// `NavigationSkipped`, was der Scroller genauso beantwortet. Ein Klick auf
// „nächster Spieltag" hätte die Seite also an den Anfang geworfen; auf der
// Tabellenseite steht das Auswahlfeld unter der ganzen Tabelle, dort wäre nach
// jedem Wechsel die eigene Auswahl aus dem Bild gescrollt. Eine
// Navigations-Option zum Abschalten gibt es nicht (`NavigationBehaviorOptions`
// kennt nur onSameUrlNavigation, skipLocationChange, replaceUrl, state, info und
// browserUrl).
//
// `createUrlTree` rechnet die Adresse mit derselben Semantik aus, die
// `queryParamsHandling: 'merge'` bei einer Navigation hätte (`null` entfernt den
// Parameter), und `Location.replaceState` schreibt sie in den bestehenden
// Verlaufseintrag. Kein Router-Vorgang, kein Sprung, und der Zurück-Weg aus dem
// Spiel findet den Eintrag mit der Nummer vor.
//
// Preis dieser Wahl: Der Router weiß von der Änderung nichts, `route.snapshot`
// wird also nicht nachgeführt. Deshalb liest die Übersicht die Adresse nur
// einmal beim Aufbau und entscheidet danach aus ihrem eigenen Zustand.
//
// Beim Server-Rendern (Prerender) gibt es keine Adressleiste, dort ist der
// Aufruf ein No-op.
export function writeMatchDayToUrl(
  router: Router,
  location: Location,
  route: ActivatedRoute,
  platformId: object,
  matchDay?: number
): void {
  if (!isPlatformBrowser(platformId)) {
    return;
  }

  const urlTree = router.createUrlTree([], {
    relativeTo: route,
    queryParams: { [MATCH_DAY_PARAM]: matchDay ?? null },
    queryParamsHandling: 'merge',
  });

  location.replaceState(router.serializeUrl(urlTree));
}
