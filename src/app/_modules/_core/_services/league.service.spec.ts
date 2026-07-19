import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { LeagueService } from './league.service';
import { AssociationService } from './association.service';
import { GameOperation, League } from '@floorball/types';
import { environment } from 'src/environments/environment';

describe('LeagueService', () => {
  let service: LeagueService;
  let httpMock: HttpTestingController;
  let associationServiceMock: {
    selectedAssociation$: unknown;
    currentSeasonId$: unknown;
    selectSeason: jasmine.Spy;
  };
  let routerMock: { navigate: jasmine.Spy };

  const association = { id: 1, path: 'fvd' } as GameOperation;
  const currentLeague = { id: 1000, name: 'Aktuelle Liga' } as League;
  const pastLeague = {
    id: 944,
    name: '1. FBL',
    season_id: '12',
  } as League;

  const leaguesUrl = (seasonId: number) =>
    `${environment.apiURL}game_operations/1/leagues/${seasonId}.json`;
  const singleLeagueUrl = `${environment.apiURL}leagues/944.json`;

  beforeEach(() => {
    associationServiceMock = {
      selectedAssociation$: of(association),
      currentSeasonId$: of(18),
      selectSeason: jasmine.createSpy('selectSeason'),
    };

    routerMock = {
      navigate: jasmine
        .createSpy('navigate')
        .and.returnValue(Promise.resolve(true)),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        LeagueService,
        { provide: AssociationService, useValue: associationServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    service = TestBed.inject(LeagueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('liefert eine Liga aus der Ligenliste der gewählten Saison', (done) => {
    service.getLeague(1000).subscribe((league) => {
      expect(league).toEqual(currentLeague);
      expect(associationServiceMock.selectSeason).not.toHaveBeenCalled();
      done();
    });

    httpMock.expectOne(leaguesUrl(18)).flush([currentLeague]);
  });

  it('lädt eine Liga aus einer anderen Saison einzeln nach (ohne selbst die Saison umzustellen)', (done) => {
    service.getLeague(944).subscribe((league) => {
      expect(league).toEqual(pastLeague);
      // getLeague stellt die Saison nicht mehr selbst um – das übernimmt
      // selectedLeague$ (siehe eigener Test).
      expect(associationServiceMock.selectSeason).not.toHaveBeenCalled();
      done();
    });

    httpMock.expectOne(leaguesUrl(18)).flush([currentLeague]);
    httpMock.expectOne(singleLeagueUrl).flush(pastLeague);
  });

  it('liefert null, wenn die Liga auch einzeln nicht gefunden wird', (done) => {
    service.getLeague(944).subscribe((league) => {
      expect(league).toBeNull();
      expect(associationServiceMock.selectSeason).not.toHaveBeenCalled();
      done();
    });

    httpMock.expectOne(leaguesUrl(18)).flush([currentLeague]);
    httpMock
      .expectOne(singleLeagueUrl)
      .flush('not found', { status: 404, statusText: 'Not Found' });
  });

  it('stellt beim Betrachten einer Liga den Saison-Switcher auf deren Saison', (done) => {
    const route = {
      snapshot: { params: { leagueId: '944' } },
    } as unknown as ActivatedRoute;

    service.selectedLeague$.subscribe((league) => {
      if (!league) return;
      expect(league).toEqual(pastLeague);
      expect(associationServiceMock.selectSeason).toHaveBeenCalledWith(12);
      done();
    });

    service.selectLeague(route);

    httpMock.expectOne(leaguesUrl(18)).flush([currentLeague]);
    httpMock.expectOne(singleLeagueUrl).flush(pastLeague);
  });

  it('changeSeason ohne geöffnete Liga stellt die Saison direkt um', () => {
    service.changeSeason(12);

    expect(associationServiceMock.selectSeason).toHaveBeenCalledWith(12);
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('changeSeason mit geöffneter Liga navigiert zur Verbands-Übersicht und stellt erst danach die Saison um', async () => {
    // paramsInheritanceStrategy 'always': association liegt direkt auf der Liga-Route.
    const route = {
      snapshot: { params: { leagueId: '944', association: 'fvd' } },
    } as unknown as ActivatedRoute;
    service.selectLeague(route);

    service.changeSeason(12);

    expect(routerMock.navigate).toHaveBeenCalledWith(['/', 'fvd']);
    // Reihenfolge: Navigation zuerst, Saison erst im then() (siehe changeSeason).
    expect(associationServiceMock.selectSeason).not.toHaveBeenCalled();

    await routerMock.navigate.calls.mostRecent().returnValue;
    expect(associationServiceMock.selectSeason).toHaveBeenCalledWith(12);
  });

  it('changeSeason lässt die Saison unverändert, wenn die Navigation nicht zustande kommt', async () => {
    routerMock.navigate.and.returnValue(Promise.resolve(false));
    const route = {
      snapshot: { params: { leagueId: '944', association: 'fvd' } },
    } as unknown as ActivatedRoute;
    service.selectLeague(route);

    service.changeSeason(12);
    await routerMock.navigate.calls.mostRecent().returnValue;

    // Liga-Seite ist noch offen – selectSeason würde nur den Tap-Reset auslösen.
    expect(associationServiceMock.selectSeason).not.toHaveBeenCalled();
  });

  it('changeSeason nach clearLeague stellt die Saison wieder direkt um', () => {
    const route = {
      snapshot: { params: { leagueId: '944', association: 'fvd' } },
    } as unknown as ActivatedRoute;
    service.selectLeague(route);
    service.clearLeague();

    service.changeSeason(15);

    expect(associationServiceMock.selectSeason).toHaveBeenCalledWith(15);
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });
});
