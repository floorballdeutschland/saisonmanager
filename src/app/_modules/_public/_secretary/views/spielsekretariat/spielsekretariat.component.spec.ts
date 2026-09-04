import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { SpielSekretariatComponent } from './spielsekretariat.component';

describe('SpielSekretariatComponent', () => {
  let component: SpielSekretariatComponent;
  let fixture: ComponentFixture<SpielSekretariatComponent>;

  const day = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    date: '2026-01-01',
    league: 'Liga',
    league_id: null,
    arena: null,
    game_operation_slug: null,
    ...overrides,
  });

  const setData = (
    days: [ReturnType<typeof day>, ...ReturnType<typeof day>[]]
  ) => {
    component.data = {
      game_days: days,
      games: [],
      license_lists: {},
      expires_at: '2026-01-02T00:00:00Z',
    } as (typeof component)['data'];
  };

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
    it('should build the public match page url and encode the token', () => {
      setData([day({ league_id: 42, game_operation_slug: 'fd' })]);

      expect(component.matchReportUrl({ id: 7, game_day_id: 1 })).toBe(
        '/fd/42/spiel/7?secretary_token=tok%20en'
      );
    });

    it('should not link without a league id', () => {
      setData([day({ game_operation_slug: 'fd' })]);

      expect(component.matchReportUrl({ id: 7, game_day_id: 1 })).toBeNull();
    });

    it('should not link without an association slug', () => {
      setData([day({ league_id: 42 })]);

      expect(component.matchReportUrl({ id: 7, game_day_id: 1 })).toBeNull();
    });

    it('should not link before the game day is loaded', () => {
      component.data = undefined;

      expect(component.matchReportUrl({ id: 7, game_day_id: 1 })).toBeNull();
    });
  });

  // Ein Link deckt alle Spieltage ab, die am selben Tag in derselben Halle
  // laufen. Ein Spiel der zweiten Liga darf dann nicht unter der leagueId der
  // ersten verlinkt werden.
  describe('mit mehreren Spieltagen im Link', () => {
    beforeEach(() => {
      setData([
        day({
          id: 1,
          league: 'U15',
          league_id: 10,
          game_operation_slug: 'fd',
          arena: 'Sporthalle Nord',
        }),
        day({
          id: 2,
          league: 'U17',
          league_id: 20,
          game_operation_slug: 'fd',
          arena: 'Sporthalle Nord',
        }),
      ]);
    });

    it('verlinkt jedes Spiel unter der Liga seines eigenen Spieltags', () => {
      expect(component.matchReportUrl({ id: 7, game_day_id: 2 })).toBe(
        '/fd/20/spiel/7?secretary_token=tok%20en'
      );
    });

    it('verlinkt nicht, wenn der Spieltag des Spiels unbekannt ist', () => {
      expect(component.matchReportUrl({ id: 7, game_day_id: 99 })).toBeNull();
    });

    it('nennt alle Ligen im Kopf und schaltet die Liga je Spiel frei', () => {
      expect(component.headerTitle()).toBe('U15 · U17');
      expect(component.multipleLeagues).toBe(true);
      expect(component.arena()).toBe('Sporthalle Nord');
      expect(component.date()).toBe('2026-01-01');
    });

    it('zeigt die Liga an jedem Spiel, sobald der Link mehrere umfasst', () => {
      component.data = {
        ...component.data!,
        games: [
          {
            id: 7,
            game_day_id: 2,
            league: 'U17',
            home_team: 'A',
            guest_team: 'B',
          },
        ],
      } as (typeof component)['data'];
      // ngOnInit stößt beim ersten detectChanges den Abruf an, der im Test nie
      // antwortet – sonst zeigt die Seite dauerhaft den Ladezustand.
      component.loading = false;

      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('A');
      expect(text).toContain('U17');
    });
  });

  describe('Lizenzlisten nach Liga', () => {
    const build = (
      days: [ReturnType<typeof day>, ...ReturnType<typeof day>[]],
      licenseLists: Record<string, unknown>
    ) =>
      component['_buildLicenseGroups']({
        game_days: days,
        games: [],
        license_lists: licenseLists,
        expires_at: '2026-01-02T00:00:00Z',
      } as unknown as NonNullable<(typeof component)['data']>);

    it('gruppiert nach Liga in der Reihenfolge der Spieltage', () => {
      // Die Schlüssel stehen absichtlich in der „falschen" Reihenfolge: Auf die
      // Reihenfolge in einem Objekt mit zahlenartigen Schlüsseln ist kein
      // Verlass, maßgeblich sind die Spieltage.
      const groups = build(
        [
          day({ id: 1, league: 'Herren', league_id: 10 }),
          day({ id: 2, league: 'U13', league_id: 20 }),
        ],
        {
          '900': { team_name: 'U13 Gast', league_id: 20, players: [] },
          '100': { team_name: 'Herren Heim', league_id: 10, players: [] },
          '200': { team_name: 'Herren Gast', league_id: 10, players: [] },
        }
      );

      expect(groups.map((g) => g.leagueName)).toEqual(['Herren', 'U13']);
      expect(groups[0].entries.map((e) => e.team_name)).toEqual([
        'Herren Gast',
        'Herren Heim',
      ]);
      expect(groups[1].entries.map((e) => e.team_name)).toEqual(['U13 Gast']);
    });

    it('laesst Ligen ohne Lizenzliste weg', () => {
      const groups = build(
        [
          day({ id: 1, league: 'Herren', league_id: 10 }),
          day({ id: 2, league: 'U13', league_id: 20 }),
        ],
        { '100': { team_name: 'Herren Heim', league_id: 10, players: [] } }
      );

      expect(groups.length).toBe(1);
      expect(groups[0].leagueName).toBe('Herren');
    });

    it('bleibt bei einer flachen Liste, wenn die API keine Liga liefert', () => {
      const groups = build([day({ id: 1, league: 'Herren', league_id: 10 })], {
        '100': { team_name: 'Heim', players: [] },
        '200': { team_name: 'Gast', players: [] },
      });

      expect(groups.length).toBe(1);
      expect(groups[0].leagueName).toBeNull();
      expect(groups[0].entries.length).toBe(2);
    });

    it('zeigt die Ueberschrift erst ab der zweiten Liga', () => {
      component.licenseGroups = build(
        [day({ id: 1, league: 'Herren', league_id: 10 })],
        { '100': { team_name: 'Heim', league_id: 10, players: [] } }
      );
      expect(component.multipleLicenseLeagues).toBe(false);

      component.licenseGroups = build(
        [
          day({ id: 1, league: 'Herren', league_id: 10 }),
          day({ id: 2, league: 'U13', league_id: 20 }),
        ],
        {
          '100': { team_name: 'Heim', league_id: 10, players: [] },
          '900': { team_name: 'U13', league_id: 20, players: [] },
        }
      );
      expect(component.multipleLicenseLeagues).toBe(true);
    });
  });

  describe('mit einem einzelnen Spieltag', () => {
    it('nennt nur dessen Liga und blendet die Liga je Spiel aus', () => {
      setData([
        day({ league: 'U15', league_id: 10, game_operation_slug: 'fd' }),
      ]);

      expect(component.gameDays().length).toBe(1);
      expect(component.multipleLeagues).toBe(false);
      expect(component.headerTitle()).toBe('U15');
    });
  });
});
