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
import { TabletFeedbackComponent } from './tablet-feedback.component';

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

// Spiel im angegebenen Abschnitt; in der Pause liefert die API z. B. 1.5.
function inPeriod(id: number, period: number, overrides: Partial<Game> = {}) {
  return game(id, {
    current_period_title: { period } as Game['current_period_title'],
    ...overrides,
  });
}

function asShot(input: ShotInput, id = 1): Shot {
  return { ...input, id, event_id: null };
}

// Die Übertragung läuft über Promise-Ketten; ein Makrotask lässt alle
// anstehenden Mikrotasks durchlaufen.
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
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
      declarations: [TabletCaptureComponent, TabletFeedbackComponent],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabletCaptureComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.clear();
  });

  async function start(g: Game = game(4711), offsetMs = 0) {
    fixture.componentRef.setInput('game', g);
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
    await start(game(4711), 60000);
    expect(component.clockStatus).toBe('ok');

    const field = fixture.nativeElement.querySelector(
      '[data-testid="tablet-field"]'
    ) as SVGElement;
    const rect = field.getBoundingClientRect();
    const at = {
      clientX: rect.left + rect.width * 0.75,
      clientY: rect.top + rect.height * 0.25,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      bubbles: true,
    };
    const before = Date.now();
    field.dispatchEvent(new PointerEvent('pointerdown', at));
    const after = Date.now();
    // Angelegt wird erst beim Loslassen.
    expect(component.draft).toBeNull();
    field.dispatchEvent(
      new PointerEvent('pointerup', { ...at, clientX: at.clientX + 3 })
    );

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

  describe('Tippen statt Wischen', () => {
    function field(): SVGElement {
      return fixture.nativeElement.querySelector(
        '[data-testid="tablet-field"]'
      ) as SVGElement;
    }

    function pointer(type: string, init: PointerEventInit) {
      const rect = field().getBoundingClientRect();
      field().dispatchEvent(
        new PointerEvent(type, {
          clientX: rect.left + rect.width / 2 + 20,
          clientY: rect.top + rect.height / 2,
          pointerId: 1,
          isPrimary: true,
          button: 0,
          bubbles: true,
          ...init,
        })
      );
    }

    it('legt beim Wischen keinen Schuss an', async () => {
      await start();
      pointer('pointerdown', {});
      const rect = field().getBoundingClientRect();
      pointer('pointerup', { clientX: rect.left + rect.width / 2 + 80 });
      expect(component.draft).toBeNull();
    });

    it('ignoriert zweiten Finger, Rechtsklick und Abbruch', async () => {
      await start();
      pointer('pointerdown', { isPrimary: false, pointerId: 2 });
      pointer('pointerup', { isPrimary: false, pointerId: 2 });
      pointer('pointerdown', { button: 2 });
      pointer('pointerup', { button: 2 });
      pointer('pointerdown', {});
      pointer('pointercancel', {});
      pointer('pointerup', {});
      expect(component.draft).toBeNull();
    });
  });

  it('legt nach dem Zeitfenster einen neuen Entwurf mit neuem Zeitpunkt an', async () => {
    await start();
    component.startDraft(0.7, 0.5, Date.UTC(2026, 9, 16, 12, 0, 0));
    const first = component.draft!;

    component.startDraft(0.6, 0.4, Date.UTC(2026, 9, 16, 12, 0, 30));

    expect(component.draft!.client_uuid).not.toBe(first.client_uuid);
    expect(component.draft!.tapped_at).toBe('2026-10-16T12:00:30.000Z');
  });

  it('korrigiert einen Tipp vor dem Ende der Uhrmessung mit dem gespeicherten Versatz', async () => {
    localStorage.setItem('tablet_clock_offset', '60000');
    fixture.componentRef.setInput('game', game(4711));
    fixture.detectChanges();
    http.expectOne(API + 'games/4711/shots.json').flush({ shots: [] });

    // Messung läuft noch.
    expect(component.clockStatus).toBe('measuring');
    component.startDraft(0.8, 0.5, Date.UTC(2026, 9, 16, 12, 0, 0));
    expect(component.draft!.tapped_at).toBe('2026-10-16T12:01:00.000Z');

    // Die Messung ergibt 30 s; gespeichert wird mit dem gemessenen Wert.
    for (let i = 0; i < 3; i++) {
      http
        .expectOne(API + 'server_time.json')
        .flush({ now: new Date(Date.now() + 30000).toISOString() });
      await settle();
    }
    expect(component.clockStatus).toBe('ok');
    component.setDraftResult('saved');
    component.saveDraft();

    const post = http.expectOne(API + 'games/4711/shots.json');
    const tapped = Date.parse(post.request.body.shots[0].tapped_at);
    expect(Math.abs(tapped - Date.UTC(2026, 9, 16, 12, 0, 30))).toBeLessThan(
      1000
    );
    post.flush({ shots: [] });
    await settle();
  });

  it('räumt beim Zerstören Takt und online-Lauscher ab', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    component.setDraftResult('saved');
    component.saveDraft();
    http
      .expectOne(API + 'games/4711/shots.json')
      .error(new ProgressEvent('error'), { status: 0 });
    await settle();
    expect(component.pendingCount).toBe(1);

    const clear = spyOn(window, 'clearInterval').and.callThrough();
    fixture.destroy();
    expect(clear).toHaveBeenCalled();

    window.dispatchEvent(new Event('online'));
    await settle();
    http.expectNone(API + 'games/4711/shots.json');
  });

  it('löscht auch einen Schuss, dessen POST noch läuft', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    component.setDraftResult('saved');
    component.saveDraft();
    const post = http.expectOne(API + 'games/4711/shots.json');
    const sent = post.request.body.shots[0] as ShotInput;

    // Gelöscht, bevor die Antwort da ist: Der Server kennt ihn danach.
    component.deleteShot(sent.client_uuid);
    expect(component.recentShots).toEqual([]);
    post.flush({ shots: [asShot(sent)] });
    await settle();

    const del = http.expectOne(
      API + 'games/4711/shots/' + sent.client_uuid + '.json'
    );
    expect(del.request.method).toBe('DELETE');
    del.flush({ shots: [] });
    await settle();
    expect(component.pendingCount).toBe(0);
    expect(component.recentShots).toEqual([]);
  });

  it('puffert nach einer Absage nur noch und sendet erst auf Wunsch', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    component.setDraftResult('saved');
    component.saveDraft();
    http
      .expectOne(API + 'games/4711/shots.json')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    await settle();
    fixture.detectChanges();

    expect(component.syncForbidden).toBeTrue();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="tablet-sync-forbidden"]'
      )
    ).not.toBeNull();

    component.startDraft(0.8, 0.5, Date.now() + 60000);
    component.setDraftResult('missed');
    component.saveDraft();
    window.dispatchEvent(new Event('online'));
    await settle();
    http.expectNone(API + 'games/4711/shots.json');
    expect(component.pendingCount).toBe(2);

    component.retryNow();
    const retry = http.expectOne(API + 'games/4711/shots.json');
    expect(retry.request.body.shots.length).toBe(2);
    retry.flush({ shots: [] });
    await settle();
    expect(component.syncForbidden).toBeFalse();
  });

  it('bietet als Schütze und Torhüter nur Spieler der passenden Aufstellung an', async () => {
    await start();
    component.startDraft(0.8, 0.5);
    // Heim schießt: Schützen aus Heim, Torhüter aus Gast.
    expect(component.fieldPlayers('home').map((p) => p.player_id)).toEqual([
      101,
    ]);
    // Eine fremde ID (etwa nach Teamwechsel) wird nicht gesendet.
    component.draft!.shooter_player_id = 201;
    component.setDraftResult('saved');
    component.saveDraft();
    const post = http.expectOne(API + 'games/4711/shots.json');
    expect(post.request.body.shots[0].shooter_player_id).toBeNull();
    expect(post.request.body.shots[0].goalkeeper_player_id).toBe(299);
    post.flush({ shots: [] });
    await settle();
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
    await start(inPeriod(4711, 2));
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
  describe('Abschnitt folgt dem Spielstand', () => {
    // Nachladen der Spielseite: neues Objekt für dasselbe Spiel.
    function reload(g: Game): void {
      fixture.componentRef.setInput('game', g);
      fixture.detectChanges();
    }

    function query(testId: string): HTMLElement | null {
      return fixture.nativeElement.querySelector(
        `[data-testid="${testId}"]`
      ) as HTMLElement | null;
    }

    it('startet im Abschnitt des Spiels und rundet die Pause ab', async () => {
      await start(inPeriod(4711, 1.5));
      expect(component.viewPeriod).toBe(1);
      expect(component.followsGame).toBeTrue();
      expect(query('tablet-period-deviates')).toBeNull();
    });

    it('wechselt mit, wenn ein anderes Gerät den Abschnitt weiterschaltet', async () => {
      await start(inPeriod(4711, 1));
      reload(inPeriod(4711, 1.5));
      expect(component.viewPeriod).toBe(1);
      reload(inPeriod(4711, 2));
      expect(component.viewPeriod).toBe(2);
      expect(component.gamePeriod).toBe(2);
      expect(component.followsGame).toBeTrue();
    });

    it('lässt eine Handauswahl stehen, bis sich der Spielabschnitt ändert', async () => {
      await start(inPeriod(4711, 2));
      component.selectViewPeriod(1);
      fixture.detectChanges();
      expect(query('tablet-period-deviates')).not.toBeNull();

      // Nachladen ohne Abschnittswechsel: Nachtrag bleibt im 1. Abschnitt.
      reload(inPeriod(4711, 2, { audience: 120 } as Partial<Game>));
      expect(component.viewPeriod).toBe(1);

      reload(inPeriod(4711, 3));
      expect(component.viewPeriod).toBe(3);
      fixture.detectChanges();
      expect(query('tablet-period-deviates')).toBeNull();
    });

    it('führt zurück zum Spielabschnitt per Knopf', async () => {
      await start(inPeriod(4711, 2));
      component.selectViewPeriod(1);
      fixture.detectChanges();
      query('tablet-follow-game-period')!.click();
      expect(component.viewPeriod).toBe(2);
    });

    it('wartet mit dem Wechsel, solange ein Entwurf offen ist (Speichern)', async () => {
      await start(inPeriod(4711, 1));
      component.startDraft(0.8, 0.5);
      reload(inPeriod(4711, 2));

      expect(component.viewPeriod).toBe(1);
      expect(component.draft!.period).toBe(1);
      expect(component.periodChangePending).toBeTrue();
      fixture.detectChanges();
      expect(query('tablet-period-pending')).not.toBeNull();

      component.setDraftResult('saved');
      component.saveDraft();
      const post = http.expectOne(API + 'games/4711/shots.json');
      expect(post.request.body.shots[0].period).toBe(1);
      expect(component.viewPeriod).toBe(2);
      expect(component.periodChangePending).toBeFalse();
      post.flush({ shots: [asShot(post.request.body.shots[0])] });
      await settle();
    });

    it('wartet mit dem Wechsel, solange ein Entwurf offen ist (Verwerfen)', async () => {
      await start(inPeriod(4711, 1));
      component.startDraft(0.8, 0.5);
      reload(inPeriod(4711, 2));
      expect(component.viewPeriod).toBe(1);

      component.cancelDraft();
      expect(component.viewPeriod).toBe(2);
    });

    it('kehrt nach dem Korrigieren eines älteren Schusses zurück', async () => {
      await start(inPeriod(4711, 1));
      component.startDraft(0.8, 0.5);
      component.setDraftResult('saved');
      component.saveDraft();
      const post = http.expectOne(API + 'games/4711/shots.json');
      post.flush({ shots: [asShot(post.request.body.shots[0])] });
      await settle();

      reload(inPeriod(4711, 2));
      expect(component.viewPeriod).toBe(2);

      component.editShot(component.recentShots[0]);
      expect(component.viewPeriod).toBe(1);
      component.cancelDraft();
      expect(component.viewPeriod).toBe(2);
    });

    it('beginnt nach einem Spielwechsel im Abschnitt des neuen Spiels', async () => {
      await start(inPeriod(4711, 3));
      component.startDraft(0.8, 0.5);
      reload(inPeriod(4711, 3.5));

      reload(inPeriod(4712, 1));
      http.expectOne(API + 'games/4712/shots.json').flush({ shots: [] });
      expect(component.draft).toBeNull();
      expect(component.viewPeriod).toBe(1);
      expect(component.gamePeriod).toBe(1);
      expect(component.periodChangePending).toBeFalse();
    });
  });
});
