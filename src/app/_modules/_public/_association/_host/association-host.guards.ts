import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AssociationService } from '@floorball/core';
import { catchError, map, of, take, timeout } from 'rxjs';

// Wie lange die Prüfung auf `init.json` wartet, bevor sie den Host durchlässt.
// Die Antwort braucht die Seite ohnehin; hängt sie, soll wenigstens die
// Navigation nicht mit hängen.
export const ASSOCIATION_MATCH_TIMEOUT_MS = 10_000;

/**
 * Lässt den Spielbetriebs-Host nur für Kürzel zu, die es als Spielbetrieb gibt.
 *
 * Der Host matcht mit ':association' jedes erste URL-Segment. Ohne diese
 * Prüfung nahm er Pfade wie /gibtsnicht oder /verwaltung/gibtsnicht ab und
 * zeigte einen leeren Rahmen bzw. die Übersicht einer Liga, die es nicht gibt;
 * die 404-Seite erreichten erst Pfade ab drei Segmenten (#455). Ein
 * unbekannter Verband zeigte auch vorher keinen Inhalt: `leagues$` bleibt ohne
 * gewählten Spielbetrieb leer, und die Liga wird darüber aufgelöst.
 *
 * Die Kürzel kommen aus `init.json`, die der AssociationService beim Start
 * einmal lädt und zwischenspeichert (`shareReplay`). Die Prüfung stellt also
 * keinen eigenen Request. Verglichen wird wie in `selectedAssociation$`, exakt
 * gegen `path` (in der API `GameOperation#slug`).
 *
 * Scheitert oder hängt `init.json`, geht der Pfad an den Host wie bisher:
 * Lieber einmal zu viel der leere Rahmen als eine 404 für einen echten
 * Verband, nur weil die API kurz nicht antwortet. Das gilt auch beim
 * Prerendering, wo die Prüfung serverseitig gegen dieselbe API läuft.
 */
export const associationMatchGuard: CanMatchFn = (_route, segments) => {
  const association = segments[0]?.path;
  if (!association) {
    return true;
  }

  return inject(AssociationService).associations$.pipe(
    take(1),
    timeout({ first: ASSOCIATION_MATCH_TIMEOUT_MS }),
    map(
      (associations) =>
        !Array.isArray(associations) ||
        associations.length === 0 ||
        associations.some((a) => a.path === association)
    ),
    catchError(() => of(true))
  );
};

/**
 * Lässt die Liga-Ebene nur für Segmente zu, die mit einer Liga-ID beginnen.
 *
 * Die Liga wird über `parseInt(leagueId)` aufgelöst, also aus der Zahl vor dem
 * ersten Bindestrich (`2447-1-fbl-herren`, auch nackt `2447`). Ein Segment
 * ohne führende Zahl (/fd/gibtsnicht) kann keine Liga treffen und fällt so auf
 * die 404-Seite, ohne dass dafür eine Liga abgefragt wird.
 *
 * Ob es eine Liga mit dieser ID gibt, prüft die Funktion bewusst nicht: Das
 * bräuchte einen Request je Navigation, und Ligen vergangener Saisons lädt der
 * LeagueService ohnehin einzeln nach.
 */
export const leagueIdMatchGuard: CanMatchFn = (_route, segments) =>
  /^\d+(?:-|$)/.test(segments[0]?.path ?? '');
