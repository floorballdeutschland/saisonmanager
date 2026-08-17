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
  // hängt an jedem Seitenaufbau ein Request pro auswertendem Strom.
  it('lädt init nur einmal, egal wie viele Ströme daran hängen', () => {
    service.seasons$.pipe(take(1)).subscribe();
    service.associations$.pipe(take(1)).subscribe();
    service.stateAssociations$.pipe(take(1)).subscribe();

    httpMock.expectOne(initUrl).flush(initPayload);
    httpMock.verify();
  });
});
