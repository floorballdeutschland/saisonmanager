import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { take } from 'rxjs';

import { AssociationService } from './association.service';
import { environment } from 'src/environments/environment';

// Die Fälle zu den gepflegten Informationsblättern sind mit #456 entfallen; der
// Mechanismus ist ausgebaut. Was bleibt, ist die Grundzusage des Service: init
// wird genau einmal geladen (shareReplay) und speist alle Ströme daraus.
describe('AssociationService', () => {
  let service: AssociationService;
  let httpMock: HttpTestingController;

  const initUrl = `${environment.apiURL}init.json`;
  const initPayload = {
    seasons: [{ id: 18, name: '2026/2027', current: true }],
    current_season_id: 18,
    game_operations: [],
    state_associations: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
    });
    // Der Konstruktor lädt init – erst nach dem Abonnieren flushen.
    service = TestBed.inject(AssociationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('speist die Saisons aus init', () => {
    let seasons: unknown[] | undefined;
    service.seasons$.pipe(take(1)).subscribe((s) => (seasons = s));

    httpMock.expectOne(initUrl).flush(initPayload);

    expect(seasons).toEqual(initPayload.seasons);
  });

  // shareReplay: mehrere Abonnenten dürfen init nicht mehrfach anfordern, sonst
  // hängt an jedem Seitenaufbau ein Request pro auswertendem Strom. Der Fall
  // fängt vor allem den naheliegenden Umbau-Unfall, dass ein einzelner Strom
  // wieder sein eigenes getInit() bekommt.
  it('lädt init nur einmal, egal wie viele Ströme daran hängen', () => {
    service.seasons$.pipe(take(1)).subscribe();
    service.associations$.pipe(take(1)).subscribe();
    service.stateAssociations$.pipe(take(1)).subscribe();

    // match statt expectOne: expectOne wirft bei zwei Requests mit einer
    // Jasmine-fremden Meldung, match liefert die Zahl und macht die Erwartung
    // ausdrücklich. Sonst hat dieser Fall gar keine Expectation und Jasmine
    // meldet ihn als "has no expectations".
    const requests = httpMock.match(initUrl);
    expect(requests.length).toBe(1);
    requests[0].flush(initPayload);
  });

  // Der Dedupe-Guard in selectSeason ist der einzige Zweig hier, an dem ein
  // Fehler nicht auffällt, sondern nur bremst: Ohne ihn emittiert jeder Aufruf
  // erneut, und Abonnenten wie der Einzel-Liga-Fallback im LeagueService laden
  // ihre Daten jedes Mal neu. Der Kommentar an der Methode benennt genau diese
  // Regression, ein Test dafür fehlte.
  describe('selectSeason', () => {
    // Beobachtet wird ueber currentSeasonId$: die Id-Quelle selbst ist privat,
    // und dieser Strom gibt sie unveraendert weiter (nur null wird zu 0).
    function watchEmissions(): number[] {
      const seen: number[] = [];
      service.currentSeasonId$.subscribe((id) => seen.push(id));
      return seen;
    }

    it('emittiert dieselbe Saison nicht zweimal', () => {
      httpMock.expectOne(initUrl).flush(initPayload);
      const seen = watchEmissions();
      const before = seen.length;

      service.selectSeason(17);
      service.selectSeason(17);

      expect(seen.length - before).toBe(1);
      expect(seen[seen.length - 1]).toBe(17);
    });

    it('emittiert bei einem echten Saisonwechsel', () => {
      httpMock.expectOne(initUrl).flush(initPayload);
      const seen = watchEmissions();
      const before = seen.length;

      service.selectSeason(17);
      service.selectSeason(18);

      expect(seen.length - before).toBe(2);
      expect(seen[seen.length - 1]).toBe(18);
    });
  });
});
