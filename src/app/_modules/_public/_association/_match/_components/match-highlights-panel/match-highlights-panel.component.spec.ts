import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import {
  getTranslocoTestingModule,
  YoutubeIframeApiService,
} from '@floorball/core';
import { Game, Highlights } from '@floorball/types';
import matchDe from '../../../../../../../assets/i18n/match/de.json';
import { MatchHighlightsComponent } from '../match-highlights/match-highlights.component';
import { MatchHighlightsPanelComponent } from './match-highlights-panel.component';

function game(id: number, overrides: Partial<Game> = {}): Game {
  return {
    id,
    home_team_name: 'Heim',
    guest_team_name: 'Gast',
    ended: true,
    tablet_capture: true,
    ...overrides,
  } as Game;
}

function highlights(overrides: Partial<Highlights> = {}): Highlights {
  return {
    video_id: 'abc123',
    scenes: [
      {
        event_id: 11,
        start: 100,
        end: 120,
        team: 'home',
        home_goals: 1,
        guest_goals: 0,
        period: 1,
        game_time: '01:10',
        scorer: { trikot_number: 10, name: 'A. Schütze' },
        assist: null,
      },
    ],
    ...overrides,
  };
}

describe('MatchHighlightsPanelComponent', () => {
  let fixture: ComponentFixture<MatchHighlightsPanelComponent>;
  let component: MatchHighlightsPanelComponent;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const url = (id: number) => (r: { url: string }) =>
    r.url.endsWith(`games/${id}/highlights.json`);
  const player = () => el().querySelector('fb-match-highlights');
  const editLink = () =>
    el().querySelector<HTMLAnchorElement>('[data-test="highlights-edit"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule({ de: { match: matchDe } }),
      ],
      declarations: [MatchHighlightsPanelComponent, MatchHighlightsComponent],
      providers: [
        {
          provide: YoutubeIframeApiService,
          useValue: jasmine.createSpyObj('YoutubeIframeApiService', [
            'createPlayer',
          ]),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchHighlightsPanelComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(
    data: Highlights | null,
    g: Game = game(1),
    status = 404
  ): void {
    fixture.componentRef.setInput('game', g);
    fixture.detectChanges();
    const req = http.expectOne(url(g.id));
    if (data) {
      req.flush(data);
    } else {
      req.flush('nichts', { status, statusText: 'Fehler' });
    }
    fixture.detectChanges();
  }

  it('lädt die Szenen des Spiels und zeigt den Player', () => {
    load(highlights());
    expect(player()).toBeTruthy();
    expect(el().textContent).toContain('A. Schütze');
  });

  it('nimmt in der Szenenliste den Kurznamen der Mannschaft', () => {
    load(
      highlights(),
      game(1, { home_team_short_name: 'HEI' } as Partial<Game>)
    );
    expect(el().textContent).toContain('HEI');
  });

  describe('ohne Szenen rendert nichts, auch keine Hülle', () => {
    it('bei leerer Szenenliste', () => {
      load(highlights({ scenes: [] }));
      expect(el().querySelector('[data-test="highlights-panel"]')).toBeNull();
    });

    it('ohne Video, auch wenn es Szenen gibt', () => {
      load(highlights({ video_id: null }));
      expect(el().querySelector('[data-test="highlights-panel"]')).toBeNull();
    });

    it('bei 404', () => {
      load(null);
      expect(el().querySelector('[data-test="highlights-panel"]')).toBeNull();
    });
  });

  it('verschwindet still, wenn YouTube das Video ablehnt', () => {
    load(highlights());
    component.onUnavailable();
    fixture.detectChanges();
    expect(player()).toBeNull();
  });

  describe('Link „Highlights bearbeiten“ (api#838)', () => {
    it('fehlt ohne check_game', () => {
      load(highlights(), game(1, { permission: ['edit'] } as Partial<Game>));
      expect(player()).toBeTruthy();
      expect(editLink()).toBeNull();
    });

    it('steht mit check_game neben dem Player und führt zum Editor', () => {
      load(
        highlights(),
        game(1, { permission: ['check_game'] } as Partial<Game>)
      );
      expect(player()).toBeTruthy();
      expect(editLink()?.getAttribute('href')).toBe(
        '/highlights/bearbeiten?spiel=1'
      );
    });

    // Ohne Auswahl gibt es keine Szene; der Weg zum Editor muss trotzdem da sein.
    it('steht mit check_game auch ohne Szenen da', () => {
      load(null, game(1, { permission: ['check_game'] } as Partial<Game>));
      expect(player()).toBeNull();
      expect(editLink()).toBeTruthy();
    });
  });

  describe('Spielwechsel', () => {
    it('bricht den Abruf für das alte Spiel ab und lädt das neue', () => {
      fixture.componentRef.setInput('game', game(1));
      fixture.detectChanges();
      const alt = http.expectOne(url(1));

      fixture.componentRef.setInput('game', game(2));
      fixture.detectChanges();

      expect(alt.cancelled).toBeTrue();
      http.expectOne(url(2)).flush(highlights({ video_id: 'neu' }));
      fixture.detectChanges();
      expect(component.highlights?.video_id).toBe('neu');
    });

    it('setzt den alten Stand sofort zurück', () => {
      load(highlights());
      component.onUnavailable();

      fixture.componentRef.setInput('game', game(2));
      fixture.detectChanges();

      expect(component.highlights).toBeUndefined();
      expect(component.unavailable).toBeFalse();
      expect(player()).toBeNull();
      http.expectOne(url(2)).flush(highlights());
      fixture.detectChanges();
      expect(player()).toBeTruthy();
    });
  });

  describe('Nachladen', () => {
    it('lädt ein laufendes Spiel im Takt nach, nicht bei jeder Spieländerung', () => {
      load(highlights({ scenes: [] }), game(1, { ended: false }));

      fixture.componentRef.setInput(
        'game',
        game(1, { ended: false, result_string: '1:0' })
      );
      fixture.detectChanges();
      http.expectNone(url(1));

      component.onRefreshTick();
      http.expectOne(url(1)).flush(highlights());
      fixture.detectChanges();
      expect(player()).toBeTruthy();
    });

    it('lässt bei einem Aussetzer den bisherigen Stand stehen', () => {
      load(highlights(), game(1, { ended: false }));

      component.onRefreshTick();
      http
        .expectOne(url(1))
        .flush('weg', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(player()).toBeTruthy();
    });

    it('lädt ein beendetes Spiel nicht im Takt, aber still bei Spieländerung', () => {
      load(highlights());

      component.onRefreshTick();
      http.expectNone(url(1));

      fixture.componentRef.setInput('game', game(1, { result_string: '3:0' }));
      fixture.detectChanges();
      http.expectOne(url(1)).flush(highlights());
    });
  });
});
