import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { SpielSekretariatComponent } from './spielsekretariat.component';

describe('SpielSekretariatComponent', () => {
  let component: SpielSekretariatComponent;
  let fixture: ComponentFixture<SpielSekretariatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [SpielSekretariatComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ token: 'tok en' }) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpielSekretariatComponent);
    component = fixture.componentInstance;
    component.token = 'tok en';
  });

  describe('matchReportUrl', () => {
    // Die öffentliche Spielseite liegt unter /:association/:leagueId/spiel/:matchId.
    // Ein Teilpfad ist gefährlich statt harmlos: :association/:leagueId schluckt
    // zwei beliebige Segmente, sodass eine falsche Adresse als leere Seite endet.
    const setGameDay = (
      gameDay: Partial<{ league_id: number; game_operation_slug: string }>
    ) => {
      component.data = {
        game_day: { id: 1, date: '2026-01-01', league: 'Liga', ...gameDay },
        games: [],
        license_lists: {},
        expires_at: '2026-01-02T00:00:00Z',
      } as (typeof component)['data'];
    };

    it('should build the public match page url and encode the token', () => {
      setGameDay({ league_id: 42, game_operation_slug: 'fd' });

      expect(component.matchReportUrl(7)).toBe(
        '/fd/42/spiel/7?secretary_token=tok%20en'
      );
    });

    it('should not link without a league id', () => {
      setGameDay({ game_operation_slug: 'fd' });

      expect(component.matchReportUrl(7)).toBeNull();
    });

    it('should not link without an association slug', () => {
      setGameDay({ league_id: 42 });

      expect(component.matchReportUrl(7)).toBeNull();
    });

    it('should not link before the game day is loaded', () => {
      component.data = undefined;

      expect(component.matchReportUrl(7)).toBeNull();
    });
  });
});
