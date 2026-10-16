import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { getTranslocoTestingModule } from '@floorball/core';
import { Game, Shot, ShotInput } from '@floorball/types';
import { environment } from 'src/environments/environment';

import { TabletCaptureComponent } from './tablet-capture.component';

const API = environment.apiURL;

function game(id: number, overrides: Partial<Game> = {}): Game {
  return {
    id,
    home_team_name: 'Heim',
    guest_team_name: 'Gast',
    events: [],
    period_titles: [
      { period: 1, status_id: 'period1', running: true },
      { period: 2, status_id: 'period2', running: true },
      { period: 3, status_id: 'period3', running: true },
    ],
    players: {
      home: [
        { player_id: 101, trikot_number: 7, goalkeeper: false },
        { player_id: 199, trikot_number: 1, goalkeeper: true },
      ],
      guest: [
        { player_id: 201, trikot_number: 9, goalkeeper: false },
        { player_id: 299, trikot_number: 30, goalkeeper: true },
      ],
    },
    starting_players: { home: [], guest: [] },
    ...overrides,
  } as unknown as Game;
}

function asShot(input: ShotInput, id = 1): Shot {
  return { ...input, id, event_id: null };
}

// Die Übertragung läuft über async/await; zwischen zwei Anfragen liegt jeweils
// ein Mikrotask.
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('TabletCaptureComponent', () => {
  let fixture: ComponentFixture<TabletCaptureComponent>;
  let component: TabletCaptureComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [TabletCaptureComponent],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabletCaptureComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.clear();
  });

  async function start(g: Game = game(4711), period = '1', offsetMs = 0) {
    fixture.componentRef.setInput('game', g);
    fixture.componentRef.setInput('currentPeriod', period);
    fixture.detectChanges();
    http.expectOne(API + 'games/' + g.id + '/shots.json').flush({ shots: [] });
    for (let i = 0; i < 3; i++) {
      await settle();
      http
        .expectOne(API + 'server_time.json')
        .flush({ now: new Date(Date.now() + offsetMs).toISOString() });
    }
    await settle();
    fixture.detectChanges();
  }

  it('hält den Zeitpunkt beim Antippen fest, korrigiert um die Serverzeit', async () => {
    await start(game(4711), '1', 60000);
    expect(component.clockStatus).toBe('ok');

    const field = fixture.nativeElement.querySelector(
      '[data-testid="tablet-field"]'
    ) as SVGElement;
    const rect = field.getBoundingClientRect();
    const before = Date.now();
    field.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: rect.left + rect.width * 0.75,
        clientY: rect.top + rect.height * 0.25,
        bubbles: true,
      })
    );
    const after = Date.now();

    const draft = component.draft!;
    expect(draft.screenX).toBeCloseTo(0.75, 2);
    expect(draft.screenY).toBeCloseTo(0.25, 2);
    // Rechte Hälfte im 1. Abschnitt: Heim greift nach rechts an.
    expect(draft.team).toBe('home');
    // Gast verteidigt: dessen Torhüter ist vorbelegt.
    expect(draft.goalkeeper_player_id).toBe(299);

    const tapped = Date.parse(draft.tapped_at);
    // Die Serverzeit wurde zum Messzeitpunkt aus Date.now() gebildet, die
    // Abweichung liegt deshalb bis auf die Laufzeit bei 60 s.
    expect(tapped).toBeGreaterThanOrEqual(before + 60000 - 1000);
    expect(tapped).toBeLessThanOrEqual(after + 60000 + 1000);
  });

  it('behält den Zeitpunkt, wenn die Stelle nachgebessert wird', async () => {
    await start();
    component.startDraft(0.7, 0.5, Date.UTC(2026, 9, 16, 12, 0, 0));
    const tappedAt = component.draft!.tapped_at;

    component.startDraft(0.6, 0.4, Date.UTC(2026, 9, 16, 12, 0, 9));

    expect(component.draft!.tapped_at).toBe(tappedAt);
    expect(component.draft!.screenX).toBe(0.6);
  });

  it('speichert normiert auf die Angriffsrichtung und sendet gepuffert', async () => {
    await start(game(4711), '2');
    // 2. Abschnitt: Heim greift nach links an. Schuss vor dem linken Tor.
    component.startDraft(0.1, 0.3);
    component.setDraftTeam('home');
    component.setDraftResult('goal');
    component.setDraftShooter(101);
    component.draft!.game_time = '1234';
    component.saveDraft();

    const request = http.expectOne(API + 'games/4711/shots.json');
    expect(request.request.method).toBe('POST');
    const sent = request.request.body.shots as ShotInput[];
    expect(sent.length).toBe(1);
    expect(sent[0]).toEqual(
      jasmine.objectContaining({
        team: 'home',
        period: 2,
        game_time: '12:34',
        x: 0.9,
        y: 0.7,
        result: 'goal',
        shooter_player_id: 101,
        goalkeeper_player_id: 299,
      })
    );
    request.flush({ shots: [asShot(sent[0])] });
    await settle();

    expect(component.pendingCount).toBe(0);
    expect(component.recentShots.length).toBe(1);
    expect(component.recentShots[0].pending).toBeFalse();
  });

  it('weist eine ungültige Spielzeit ab, ohne zu speichern', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    component.setDraftResult('saved');
    component.draft!.game_time = '12:99';
    component.saveDraft();

    expect(component.gameTimeInvalid).toBeTrue();
    expect(component.draft).not.toBeNull();
    http.expectNone(API + 'games/4711/shots.json');
  });

  it('puffert bei Verbindungsabbruch und sendet denselben Schuss später erneut', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    component.setDraftResult('saved');
    component.saveDraft();

    const first = http.expectOne(API + 'games/4711/shots.json');
    const uuid = first.request.body.shots[0].client_uuid;
    first.error(new ProgressEvent('error'), { status: 0 });
    await settle();

    expect(component.pendingCount).toBe(1);
    expect(component.syncBlocked).toBeFalse();
    expect(component.recentShots[0].pending).toBeTrue();
    // Lokal gesichert, übersteht also ein Neuladen.
    expect(localStorage.getItem('tablet_shot_buffer_4711')).toContain(uuid);

    component.retryNow();
    const second = http.expectOne(API + 'games/4711/shots.json');
    // Idempotent: dieselbe client_uuid, kein zweiter Schuss.
    expect(second.request.body.shots.length).toBe(1);
    expect(second.request.body.shots[0].client_uuid).toBe(uuid);
    second.flush({ shots: [asShot(second.request.body.shots[0])] });
    await settle();

    expect(component.pendingCount).toBe(0);
    expect(localStorage.getItem('tablet_shot_buffer_4711')).toBeNull();
  });

  it('sendet nach einer fachlichen Absage nicht automatisch weiter', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    component.setDraftResult('missed');
    component.saveDraft();

    http
      .expectOne(API + 'games/4711/shots.json')
      .flush(
        { message: 'Spielbericht geschlossen' },
        { status: 422, statusText: 'Unprocessable' }
      );
    await settle();

    expect(component.syncBlocked).toBeTrue();
    expect(component.pendingCount).toBe(1);
  });

  it('korrigiert einen Schuss unter derselben client_uuid und mit seinem Zeitpunkt', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    component.setDraftResult('saved');
    component.saveDraft();
    const first = http.expectOne(API + 'games/4711/shots.json');
    const original = first.request.body.shots[0] as ShotInput;
    first.flush({ shots: [asShot(original)] });
    await settle();

    component.editShot(component.recentShots[0]);
    expect(component.draft!.screenX).toBeCloseTo(0.8, 4);
    component.setDraftResult('goal');
    component.saveDraft();

    const second = http.expectOne(API + 'games/4711/shots.json');
    const corrected = second.request.body.shots[0] as ShotInput;
    expect(corrected.client_uuid).toBe(original.client_uuid);
    expect(corrected.tapped_at).toBe(original.tapped_at);
    expect(corrected.x).toBe(original.x);
    expect(corrected.result).toBe('goal');
    second.flush({ shots: [asShot(corrected)] });
    await settle();
  });

  it('löscht beim Server nur bekannte Schüsse', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    component.setDraftResult('saved');
    component.saveDraft();
    const post = http.expectOne(API + 'games/4711/shots.json');
    const sent = post.request.body.shots[0] as ShotInput;
    post.flush({ shots: [asShot(sent)] });
    await settle();

    component.deleteShot(sent.client_uuid);
    const del = http.expectOne(
      API + 'games/4711/shots/' + sent.client_uuid + '.json'
    );
    expect(del.request.method).toBe('DELETE');
    del.flush({ shots: [] });
    await settle();

    expect(component.recentShots).toEqual([]);
    expect(component.pendingCount).toBe(0);
  });

  it('setzt beim Spielwechsel alles zurück und verwirft späte Antworten', async () => {
    await start(game(4711));
    component.startDraft(0.8, 0.5);
    component.swapSides();

    fixture.componentRef.setInput('game', game(4712));
    fixture.detectChanges();

    expect(component.draft).toBeNull();
    expect(component.sides).toEqual({});
    http.expectOne(API + 'games/4712/shots.json').flush({
      shots: [
        asShot({
          client_uuid: 'x',
          team: 'guest',
          period: 1,
          game_time: '',
          tapped_at: '2026-10-16T12:00:00.000Z',
          x: 0.5,
          y: 0.5,
          result: 'saved',
        }),
      ],
    });
    expect(component.serverShots.length).toBe(1);

    // Rückkehr zum ersten Spiel: dessen Seitenwahl ist je Spiel gemerkt.
    fixture.componentRef.setInput('game', game(4711));
    fixture.detectChanges();
    expect(component.sides).toEqual({ '1': 'guest' });
    expect(component.serverShots).toEqual([]);
    http.expectOne(API + 'games/4711/shots.json').flush({ shots: [] });
  });

  it('bietet die Zuordnung an, wenn ein Tor keinen Schuss hat', async () => {
    const shot = asShot({
      client_uuid: 's1',
      team: 'guest',
      period: 1,
      game_time: '3:10',
      tapped_at: '2026-10-16T12:00:00.000Z',
      x: 0.9,
      y: 0.5,
      result: 'goal',
    });
    fixture.componentRef.setInput('game', game(4711));
    fixture.detectChanges();
    http.expectOne(API + 'games/4711/shots.json').flush({ shots: [shot] });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="tablet-link-help"]')
    ).toBeNull();

    // Neues Tor ohne Verknüpfung: Schüsse werden neu geladen.
    const goal = {
      event_id: 77,
      event_type: 'goal',
      event_team: 'guest',
      period: 1,
      time: '03:12',
      home_goals: 0,
      guest_goals: 1,
    };
    fixture.componentRef.setInput(
      'game',
      game(4711, { events: [goal] } as Partial<Game>)
    );
    fixture.detectChanges();
    http.expectOne(API + 'games/4711/shots.json').flush({ shots: [shot] });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="tablet-link-help"]')
    ).not.toBeNull();

    component.linkShot(shot, component.linkCandidates[0].goal);
    const link = http.expectOne(API + 'games/4711/shots/s1/link.json');
    expect(link.request.body).toEqual({ event_id: 77 });
    link.flush({ shots: [{ ...shot, event_id: 77 }] });
    expect(component.linkCandidates).toEqual([]);

    // Ausstehende Uhrmessung abräumen.
    http.match(API + 'server_time.json');
  });
});
