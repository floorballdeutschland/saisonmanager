import { ActivatedRoute, ParamMap, Router } from '@angular/router';

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
    expect(
      matchDayFromParams(params({ saison: '18', spieltag: '3' }))
    ).toBe(3);
  });
});

describe('writeMatchDayToUrl', () => {
  let router: jasmine.SpyObj<Router>;
  const route = {} as ActivatedRoute;

  // PLATFORM_ID ist als `Object` typisiert, traegt aber die Zeichenketten
  // 'browser' bzw. 'server' -- dieselbe Verrenkung wie in Angulars eigener
  // Signatur von isPlatformBrowser.
  const browser = 'browser' as unknown as object;
  const server = 'server' as unknown as object;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  });

  // `replaceUrl`, damit die durchgeklickten Spieltage keinen Verlauf anhäufen;
  // `merge`, damit andere Parameter stehen bleiben.
  it('schreibt die Nummer in die Adresse, ohne einen Verlaufseintrag anzulegen', () => {
    writeMatchDayToUrl(router, route, browser, 5);

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { [MATCH_DAY_PARAM]: 5 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('entfernt den Parameter mit null', () => {
    writeMatchDayToUrl(router, route, browser, undefined);

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: { [MATCH_DAY_PARAM]: null },
      })
    );
  });

  // Beim Prerender gibt es keine Adressleiste. Ein navigate() dort ist ein
  // Seiteneffekt in einer Umgebung, die ihn nicht braucht -- und ein
  // Prerender-Fehler bricht den Produktionsbuild ab, ohne dass CI ihn sieht.
  it('tut beim Server-Rendern nichts', () => {
    writeMatchDayToUrl(router, route, server, 5);

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
