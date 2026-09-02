import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { StreamThumbnailsComponent } from './stream-thumbnails.component';
import { Game } from '@floorball/types';

describe('StreamThumbnailsComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, HttpClientTestingModule],
      declarations: [StreamThumbnailsComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  function game(overrides: Partial<Game> = {}): Game {
    return {
      id: 1,
      league_id: 42,
      league_name: '2. Floorball-Bundesliga Herren',
      home_team_name: 'UHC Sparkasse Weißenfels',
      guest_team_name: 'MFBC Grimma',
      arena_name: 'Stadtbadhalle',
      date: '2026-10-12',
      start_time: '18:00',
      ended: false,
      permission: ['edit_game_report'],
      ...overrides,
    } as unknown as Game;
  }

  function create(
    overrides: Partial<Game> = {}
  ): ComponentFixture<StreamThumbnailsComponent> {
    const fixture = TestBed.createComponent(StreamThumbnailsComponent);
    fixture.componentInstance.game = game(overrides);
    fixture.detectChanges();

    return fixture;
  }

  function expectLeagueRequest() {
    return http.expectOne((req) => req.url.indexOf('leagues/42') !== -1);
  }

  // Ohne Recht am Spielbericht gibt es weder Abschnitt noch Abruf.
  it('bleibt ohne Recht am Spielbericht leer', () => {
    const fixture = create({ permission: [] });

    expect(fixture.componentInstance.canCreate).toBeFalse();
    expect(fixture.nativeElement.classList).toContain('hidden');
    expect(fixture.nativeElement.textContent.trim()).toBe('');
    http.expectNone((req) => req.url.indexOf('leagues/42') !== -1);
  });

  it('holt die Liga, weil Zeichen und Farbe nicht im Spielabruf stehen', () => {
    create();

    const request = expectLeagueRequest();
    expect(request.request.method).toBe('GET');
    request.flush({
      id: 42,
      name: '2. Floorball-Bundesliga Herren',
      league_class_id: '2fbl',
      female: false,
      league_type: 'league',
    });
  });

  it('bietet vor dem Spiel das Livestream-Bild an, danach das Highlight-Bild', () => {
    const before = create();
    expect(before.componentInstance.variant).toBe('livestream');
    expect(before.componentInstance.resultAvailable).toBeFalse();
    expect(
      before.componentInstance.variants.find((v) => v.value === 'highlights')
        ?.disabled
    ).toBeTrue();
    expectLeagueRequest().flush({ id: 42 });

    const after = create({
      ended: true,
      result: { home_goals: 5, guest_goals: 3 },
    } as Partial<Game>);
    expect(after.componentInstance.variant).toBe('highlights');
    expectLeagueRequest().flush({ id: 42 });
  });

  // Ein Endstand vor dem Schlusspfiff wäre eine falsche Aussage im Bild.
  it('lässt vor dem Spielende nicht auf das Highlight-Bild wechseln', () => {
    const fixture = create();
    expectLeagueRequest().flush({ id: 42 });

    fixture.componentInstance.selectVariant('highlights');

    expect(fixture.componentInstance.variant).toBe('livestream');
  });

  // Ohne Liga fehlen Zeichen und Farbwelt. Das Bild entsteht trotzdem, aber der
  // Unterschied muss dabeistehen: Sonst lädt jemand ein Bundesliga-Spiel im
  // Standardbild hoch, ohne es zu bemerken.
  it('sagt es, wenn die Ligadaten fehlen', async () => {
    const fixture = create();
    expectLeagueRequest().error(new ProgressEvent('error'));

    await fixture.componentInstance.render();

    expect(fixture.componentInstance.hint).toContain('Ligadaten');
    expect(fixture.componentInstance.error).toBe('');
  });

  // Das Datum kommt als reiner Tag (`YYYY-MM-DD`), die Anstoßzeit getrennt als
  // Zeichenkette. Über `new Date(raw)` gelesen wäre das Mitternacht UTC, und
  // westlich von Greenwich stünde der Vortag im Bild. Der handgeschriebene
  // Parser ist der einzige Schutz davor, deshalb wird er hier festgehalten.
  it('setzt Wochentag und Datum ohne Zeitzonenumweg', async () => {
    const texts: string[] = [];
    spyOn(CanvasRenderingContext2D.prototype, 'fillText').and.callFake(
      function (this: CanvasRenderingContext2D, text: string) {
        texts.push(text);
      }
    );

    const fixture = create({
      date: '2026-01-11' as unknown as Date,
      start_time: '18:00',
    });
    expectLeagueRequest().flush({ id: 42 });
    await fixture.componentInstance.render();

    expect(texts).toContain('So. 11.01.2026 · 18:00 Uhr');
  });

  it('fällt ohne verwertbares Datum auf die Anstoßzeit zurück', async () => {
    const texts: string[] = [];
    spyOn(CanvasRenderingContext2D.prototype, 'fillText').and.callFake(
      function (this: CanvasRenderingContext2D, text: string) {
        texts.push(text);
      }
    );

    const fixture = create({ date: '' as unknown as Date });
    expectLeagueRequest().flush({ id: 42 });
    await fixture.componentInstance.render();

    expect(texts).toContain('18:00 Uhr');
  });

  // Die öffentliche Spielansicht lädt alle 30 Sekunden nach und ersetzt `game`.
  // Ohne diese Reaktion trüge das Highlight-Bild nach einer Ergebniskorrektur
  // weiter den alten Stand -- und das Bild ist genau dann längst gespeichert.
  it('zeichnet nach einer Ergebniskorrektur neu', async () => {
    const fixture = create({
      ended: true,
      result: { home_goals: 5, guest_goals: 3 },
    } as Partial<Game>);
    expectLeagueRequest().flush({ id: 42 });
    await fixture.componentInstance.render();

    const texts: string[] = [];
    spyOn(CanvasRenderingContext2D.prototype, 'fillText').and.callFake(
      function (this: CanvasRenderingContext2D, text: string) {
        texts.push(text);
      }
    );

    const corrected = {
      ...fixture.componentInstance.game,
      result: { home_goals: 5, guest_goals: 4 },
    } as Game;
    fixture.componentInstance.game = corrected;
    fixture.componentInstance.ngOnChanges({
      game: {
        previousValue: game({
          ended: true,
          result: { home_goals: 5, guest_goals: 3 },
        } as Partial<Game>),
        currentValue: corrected,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    await fixture.componentInstance.render();

    expect(texts).toContain('5:4');
  });

  // Ein Spielwechsel auf derselben Route erzeugt die Komponente nicht neu. Ohne
  // erneuten Ligaabruf trüge das Bild die Paarung des neuen Spiels in der
  // Farbwelt des alten.
  it('holt die Liga nach einem Spielwechsel erneut', () => {
    const fixture = create();
    expectLeagueRequest().flush({ id: 42, league_class_id: '2fbl' });

    const other = { ...fixture.componentInstance.game, league_id: 43 } as Game;
    fixture.componentInstance.game = other;
    fixture.componentInstance.ngOnChanges({
      game: {
        previousValue: game(),
        currentValue: other,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    http
      .expectOne((req) => req.url.indexOf('leagues/43') !== -1)
      .flush({
        id: 43,
      });
  });

  it('zeichnet die Vorschau in voller Größe', async () => {
    const fixture = create();
    expectLeagueRequest().flush({
      id: 42,
      name: '2. Floorball-Bundesliga Herren',
      league_class_id: '2fbl',
      female: false,
      league_type: 'league',
    });

    await fixture.componentInstance.render();

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(fixture.componentInstance.error).toBe('');
  });
});
