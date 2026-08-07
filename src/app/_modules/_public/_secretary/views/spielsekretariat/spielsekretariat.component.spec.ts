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

      expect(component.matchReportUrl({ id: 7 })).toBe(
        '/fd/42/spiel/7?secretary_token=tok%20en'
      );
    });

    it('should not link without a league id', () => {
      setGameDay({ game_operation_slug: 'fd' });

      expect(component.matchReportUrl({ id: 7 })).toBeNull();
    });

    it('should not link without an association slug', () => {
      setGameDay({ league_id: 42 });

      expect(component.matchReportUrl({ id: 7 })).toBeNull();
    });

    it('should not link before the game day is loaded', () => {
      component.data = undefined;

      expect(component.matchReportUrl({ id: 7 })).toBeNull();
    });
  });

  // Ein Link deckt alle Spieltage ab, die am selben Tag in derselben Halle
  // laufen. Ein Spiel der zweiten Liga darf dann nicht unter der leagueId der
  // ersten verlinkt werden.
  describe('mit mehreren Spieltagen im Link', () => {
    beforeEach(() => {
      component.data = {
        game_day: {
          id: 1,
          date: '2026-01-01',
          league: 'U15',
          league_id: 10,
          game_operation_slug: 'fd',
        },
        game_days: [
          {
            id: 1,
            date: '2026-01-01',
            league: 'U15',
            league_id: 10,
            game_operation_slug: 'fd',
          },
          {
            id: 2,
            date: '2026-01-01',
            league: 'U17',
            league_id: 20,
            game_operation_slug: 'fd',
          },
        ],
        games: [],
        license_lists: {},
        expires_at: '2026-01-02T00:00:00Z',
      } as (typeof component)['data'];
    });

    it('verlinkt jedes Spiel unter der Liga seines eigenen Spieltags', () => {
      expect(component.matchReportUrl({ id: 7, game_day_id: 2 })).toBe(
        '/fd/20/spiel/7?secretary_token=tok%20en'
      );
    });

    it('verlinkt nicht, wenn der Spieltag des Spiels unbekannt ist', () => {
      expect(component.matchReportUrl({ id: 7, game_day_id: 99 })).toBeNull();
      expect(component.matchReportUrl({ id: 7 })).toBeNull();
    });

    it('nennt alle Ligen im Kopf und schaltet die Liga je Spiel frei', () => {
      expect(component.headerTitle()).toBe('U15 · U17');
      expect(component.multipleLeagues).toBe(true);
    });

    it('faellt auf den einzelnen Spieltag zurueck, wenn game_days fehlt', () => {
      component.data = {
        game_day: {
          id: 1,
          date: '2026-01-01',
          league: 'U15',
          league_id: 10,
          game_operation_slug: 'fd',
        },
        games: [],
        license_lists: {},
        expires_at: '2026-01-02T00:00:00Z',
      } as (typeof component)['data'];

      expect(component.gameDays().length).toBe(1);
      expect(component.multipleLeagues).toBe(false);
      expect(component.matchReportUrl({ id: 7 })).toBe(
        '/fd/10/spiel/7?secretary_token=tok%20en'
      );
    });
  });
});
