import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { PartialMatchRouteSnapshot, Route, UrlSegment } from '@angular/router';
import { AssociationService } from '@floorball/core';
import { GameOperation } from '@floorball/types';
import { isObservable, NEVER, Observable, of, Subject, throwError } from 'rxjs';
import {
  ASSOCIATION_MATCH_TIMEOUT_MS,
  associationMatchGuard,
  leagueIdMatchGuard,
} from './association-host.guards';

// Die Prüfungen lesen nur die Segmente, der Schnappschuss bleibt leer.
const snapshot = {} as PartialMatchRouteSnapshot;

function segments(...paths: string[]): UrlSegment[] {
  return paths.map((path) => new UrlSegment(path, {}));
}

describe('association-host.guards', () => {
  describe('associationMatchGuard', () => {
    function run(
      associations$: Observable<GameOperation[]>,
      ...paths: string[]
    ): Observable<boolean> {
      TestBed.configureTestingModule({
        providers: [
          { provide: AssociationService, useValue: { associations$ } },
        ],
      });
      const result = TestBed.runInInjectionContext(() =>
        associationMatchGuard({} as Route, segments(...paths), snapshot)
      );
      expect(isObservable(result)).toBeTrue();
      return result as Observable<boolean>;
    }

    const known = of([{ path: 'fd' }, { path: 'sbk-ost' }] as GameOperation[]);

    function valueOf(result$: Observable<boolean>): boolean | undefined {
      let value: boolean | undefined;
      result$.subscribe((v) => (value = v));
      return value;
    }

    it('lässt ein bekanntes Kürzel durch', () => {
      expect(valueOf(run(known, 'fd', '2447-1-fbl-herren'))).toBeTrue();
    });

    it('lehnt ein unbekanntes Kürzel ab', () => {
      expect(valueOf(run(known, 'verwaltung', 'gibtsnicht'))).toBeFalse();
    });

    it('vergleicht exakt, wie die Verbandsauswahl im Host', () => {
      expect(valueOf(run(known, 'FD'))).toBeFalse();
    });

    // Lieber der leere Rahmen wie früher als eine 404 für einen echten
    // Verband, nur weil die API kurz nicht antwortet.
    it('lässt durch, wenn init.json scheitert', () => {
      expect(
        valueOf(
          run(
            throwError(() => new Error('offline')),
            'fd'
          )
        )
      ).toBeTrue();
    });

    it('lässt durch, wenn init.json keine Spielbetriebe liefert', () => {
      expect(valueOf(run(of([]), 'fd'))).toBeTrue();
    });

    it('lässt nach der Wartezeit durch, wenn init.json hängt', fakeAsync(() => {
      let value: boolean | undefined;
      run(NEVER, 'fd').subscribe((v) => (value = v));

      tick(ASSOCIATION_MATCH_TIMEOUT_MS - 1);
      expect(value).toBeUndefined();

      tick(1);
      expect(value).toBeTrue();
    }));

    it('wartet auf die Antwort statt vorab zu entscheiden', () => {
      const pending$ = new Subject<GameOperation[]>();
      let value: boolean | undefined;
      run(pending$, 'gibtsnicht').subscribe((v) => (value = v));

      expect(value).toBeUndefined();
      pending$.next([{ path: 'fd' }] as GameOperation[]);
      expect(value).toBeFalse();
    });
  });

  describe('leagueIdMatchGuard', () => {
    const matches = (path: string) =>
      leagueIdMatchGuard({} as Route, segments(path), snapshot);

    it('lässt Liga-Segmente mit führender ID durch', () => {
      expect(matches('2447-1-fbl-herren')).toBeTrue();
      expect(matches('2447')).toBeTrue();
    });

    it('lehnt Segmente ohne führende ID ab', () => {
      expect(matches('gibtsnicht')).toBeFalse();
      expect(matches('spielplan')).toBeFalse();
      expect(matches('12abc')).toBeFalse();
    });
  });
});
