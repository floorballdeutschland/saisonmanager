import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { RefereeHistoryGame } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { RefereeHistoryComponent } from './referee-history.component';

describe('RefereeHistoryComponent', () => {
  let component: RefereeHistoryComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule(), HttpClientTestingModule],
      declarations: [RefereeHistoryComponent],
    })
      .overrideTemplate(RefereeHistoryComponent, '')
      .compileComponents();

    component = TestBed.createComponent(
      RefereeHistoryComponent
    ).componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function game(overrides: Partial<RefereeHistoryGame> = {}) {
    return {
      id: 7,
      game_number: '10',
      date: '2026-09-01',
      home_team: 'Heim',
      guest_team: 'Gast',
      league: 'Regionalliga',
      league_id: 5,
      game_operation_slug: 'sbk-ost',
      season_id: 18,
      ...overrides,
    } as RefereeHistoryGame;
  }

  it('verlinkt das Spiel über Verband-Slug und Liga-ID', () => {
    expect(component.matchLink(game())).toEqual([
      '/',
      'sbk-ost',
      5,
      'spiel',
      7,
    ]);
  });

  it('verlinkt nicht, wenn Verband-Slug oder Liga-ID fehlen', () => {
    expect(component.matchLink(game({ game_operation_slug: null }))).toBeNull();
    expect(component.matchLink(game({ league_id: null }))).toBeNull();
  });

  it('klappt alle geladenen Saisons auf', () => {
    component.ngOnInit();

    httpMock
      .expectOne(environment.apiURL + 'referee/history/games')
      .flush([
        { season_id: 18, season_name: '2026/2027', games: [game()] },
        { season_id: 17, season_name: '2025/2026', games: [] },
      ]);
    httpMock.expectOne(environment.apiURL + 'referee/history/tests').flush([]);

    expect(component.expandedSeasons.has(18)).toBeTrue();
    expect(component.expandedSeasons.has(17)).toBeTrue();
    expect(component.loadingGames).toBeFalse();
  });
});
