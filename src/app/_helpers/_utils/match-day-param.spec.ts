import { Location } from '@angular/common';
import { ActivatedRoute, ParamMap, Router, UrlTree } from '@angular/router';

import {
  MATCH_DAY_PARAM,
  matchDayFromParams,
  writeMatchDayToUrl,
} from './match-day-param';

// Ein ParamMap-Doppel; die echte Klasse ist Angular-intern.
function params(values: Record<string, string>): ParamMap {
  return {
    keys: Object.keys(values),
    has: (key: string) => key in values,
    get: (key: string) => (key in values ? values[key] : null),
    getAll: (key: string) => (key in values ? [values[key]] : []),
  };
}

describe('matchDayFromParams', () => {
  it('liest die Spieltagsnummer', () => {
    expect(matchDayFromParams(params({ spieltag: '5' }))).toBe(5);
  });

  // `undefined` heißt „nichts gewählt" und überlässt der API die Wahl.
  it('meldet ohne Parameter nichts', () => {
    expect(matchDayFromParams(params({}))).toBeUndefined();
  });

  // Eine von Hand verbogene Adresse darf keine Anfrage auf `spieltag=NaN`
  // auslösen, sondern muss auf den von der API bestimmten Spieltag zurückfallen.
  it('verwirft unbrauchbare Werte', () => {
    expect(matchDayFromParams(params({ spieltag: '' }))).toBeUndefined();
    expect(matchDayFromParams(params({ spieltag: 'abc' }))).toBeUndefined();
    expect(matchDayFromParams(params({ spieltag: '5abc' }))).toBeUndefined();
    expect(matchDayFromParams(params({ spieltag: '2.5' }))).toBeUndefined();
    expect(matchDayFromParams(params({ spieltag: '0' }))).toBeUndefined();
    expect(matchDayFromParams(params({ spieltag: '-3' }))).toBeUndefined();
  });

  it('ignoriert andere Parameter', () => {
    expect(matchDayFromParams(params({ saison: '18', spieltag: '3' }))).toBe(3);
  });
});

describe('writeMatchDayToUrl', () => {
  let router: jasmine.SpyObj<Router>;
  let location: jasmine.SpyObj<Location>;
  const route = {} as ActivatedRoute;
  const urlTree = {} as UrlTree;

  // PLATFORM_ID ist als `Object` typisiert, traegt aber die Zeichenketten
  // 'browser' bzw. 'server' -- dieselbe Verrenkung wie in Angulars eigener
  // Signatur von isPlatformBrowser.
  const browser = 'browser' as unknown as object;
  const server = 'server' as unknown as object;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', [
      'createUrlTree',
      'serializeUrl',
    ]);
    router.createUrlTree.and.returnValue(urlTree);
    router.serializeUrl.and.returnValue('/fvbb/2516?spieltag=5');
    location = jasmine.createSpyObj<Location>('Location', ['replaceState']);
  });

  // `merge` haelt andere Parameter, `null` entfernt den eigenen -- dieselbe
  // Semantik, die eine Navigation mit queryParamsHandling haette.
  it('rechnet die Adresse relativ zur Route aus', () => {
    writeMatchDayToUrl(router, location, route, browser, 5);

    expect(router.createUrlTree).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { [MATCH_DAY_PARAM]: 5 },
      queryParamsHandling: 'merge',
    });
  });

  // Der Kern der Entscheidung: KEINE Router-Navigation. Die Anwendung laeuft mit
  // scrollPositionRestoration 'top', jede Navigation wuerde die Seite an den
  // Anfang werfen -- auf der Tabellenseite steht das Auswahlfeld unter der
  // ganzen Tabelle.
  it('schreibt die Adresse ohne Router-Navigation', () => {
    writeMatchDayToUrl(router, location, route, browser, 5);

    expect(location.replaceState).toHaveBeenCalledWith('/fvbb/2516?spieltag=5');
    expect(
      (router as unknown as { navigate?: unknown }).navigate
    ).toBeUndefined();
  });

  it('entfernt den Parameter mit null', () => {
    writeMatchDayToUrl(router, location, route, browser, undefined);

    expect(router.createUrlTree).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({ queryParams: { [MATCH_DAY_PARAM]: null } })
    );
  });

  // Beim Prerender gibt es keine Adressleiste. Ein Seiteneffekt dort ist ohne
  // Zweck -- und ein Prerender-Fehler bricht den Produktionsbuild ab, ohne dass
  // CI ihn sieht.
  it('tut beim Server-Rendern nichts', () => {
    writeMatchDayToUrl(router, location, route, server, 5);

    expect(router.createUrlTree).not.toHaveBeenCalled();
    expect(location.replaceState).not.toHaveBeenCalled();
  });
});
