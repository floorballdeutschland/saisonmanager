import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { RefereeHistoryGame, RefereeHistorySeason } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { RefereeHistoryComponent } from './referee-history.component';

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

// Mit echtem Template: matchLink allein zu prüfen würde nicht auffallen, wenn
// die Tabelle den Link gar nicht mehr setzt oder Heim und Gast vertauscht.
describe('RefereeHistoryComponent (Template)', () => {
  let fixture: ComponentFixture<RefereeHistoryComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        getTranslocoTestingModule(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      declarations: [RefereeHistoryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeHistoryComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(games: RefereeHistoryGame[]): void {
    fixture.detectChanges();
    const season: RefereeHistorySeason = {
      season_id: 18,
      season_name: '2026/2027',
      games,
    };
    httpMock
      .expectOne(environment.apiURL + 'referee/history/games')
      .flush([season]);
    httpMock.expectOne(environment.apiURL + 'referee/history/tests').flush([]);
    fixture.detectChanges();
  }

  function cellLinks(): HTMLAnchorElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('tbody a[href]')
    ) as HTMLAnchorElement[];
  }

  it('verlinkt Heim- und Gastname auf die öffentliche Spielseite', () => {
    render([game()]);

    const links = cellLinks();
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/sbk-ost/5/spiel/7',
      '/sbk-ost/5/spiel/7',
    ]);
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Heim', 'Gast']);
  });

  it('zeigt Mannschaften ohne Link, wenn die Liga-Angaben fehlen', () => {
    render([game({ league_id: null, game_operation_slug: null })]);

    expect(cellLinks().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Heim');
    expect(fixture.nativeElement.textContent).toContain('Gast');
  });
});
