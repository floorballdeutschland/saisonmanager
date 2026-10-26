import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import {
  NotificationService,
  getTranslocoTestingModule,
} from '@floorball/core';
import { Game, Shot, ShotInput } from '@floorball/types';
import { environment } from 'src/environments/environment';

import { TabletCaptureComponent } from './tablet-capture.component';
import { freeHitZone } from '../../../_match/_utils/detailed-stats';
import { TabletFeedbackComponent } from './tablet-feedback.component';
import { TabletHighlightRequestComponent } from './tablet-highlight-request.component';

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
      declarations: [
        TabletCaptureComponent,
        TabletFeedbackComponent,
        TabletHighlightRequestComponent,
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabletCaptureComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.clear();
  });

  // Die Specs ändern den Zustand meist per Methodenaufruf statt über ein
  // DOM-Ereignis. Ohne Zone prüft `fixture.detectChanges()` dann nur, wenn
  // die View als dirty gemeldet ist; sonst läuft allein `checkNoChanges` und
  // wirft NG0100. Ob ein von `markForCheck` geplanter Tick vorher schon
  // gelaufen ist, hängt am Timing, deshalb hier immer selbst markieren.
  function render(): void {
    (
      component as unknown as { _cdr: { markForCheck(): void } }
    )._cdr.markForCheck();
    fixture.detectChanges();
  }

  // Die Uhr steht während der Messung: Sonst liegt die Antwort je nach
  // Laufzeit ein paar Millisekunden neben der Mitte des Round-Trips, und
  // jeder Zeitpunkt in den Specs weicht um diesen Versatz ab.
  async function start(g: Game = game(4711), offsetMs = 0) {
    const now = Date.now();
    const clock = spyOn(Date, 'now').and.returnValue(now);
    fixture.componentRef.setInput('game', g);
    render();
    http.expectOne(API + 'games/' + g.id + '/shots.json').flush({ shots: [] });
    for (let i = 0; i < 3; i++) {
      await settle();
      http
        .expectOne(API + 'server_time.json')
        .flush({ now: new Date(now + offsetMs).toISOString() });
    }
    await settle();
    clock.and.callThrough();
    render();
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
    // Erst wählen, was es war.
    expect(component.draft).toBeNull();
    expect(component.pendingTap).toBeTruthy();
    render();
    fixture.nativeElement
      .querySelector('[data-testid="tablet-choice-shot"]')
      .click();

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
      expect(component.pendingTap).toBeNull();
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
      expect(component.pendingTap).toBeNull();
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
    render();
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

  it('weist unter dem Titel darauf hin, dass die normale Eingabe bleibt', async () => {
    await start();
    const note = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="tablet-not-a-replacement"]'
    );
    expect(note).not.toBeNull();

    component.toggleFullscreen();
    render();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="tablet-not-a-replacement"]'
      )
    ).not.toBeNull();
    component.toggleFullscreen();
    render();
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
    render();

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

  describe('Spielfeld je Feldgröße (fe#591)', () => {
    const field = () =>
      fixture.nativeElement.querySelector(
        '[data-testid="tablet-field"]'
      ) as SVGSVGElement;

    it('zeichnet ohne Feldgröße das Großfeld, ohne Mittelkreis', async () => {
      await start();
      expect(field().getAttribute('data-field-size')).toBe('GF');
      expect(field().getAttribute('viewBox')).toBe('0 0 40 20');
      expect(field().style.aspectRatio).toBe('40 / 20');
      const center = fixture.nativeElement.querySelector(
        '[data-testid="tablet-field-center"]'
      ) as SVGCircleElement;
      expect(center.getAttribute('cx')).toBe('20');
      // Nur ein Punkt in der Mitte, kein Kreis mit 3 m Radius
      expect(Number(center.getAttribute('r'))).toBeLessThan(1);
      expect(
        fixture.nativeElement.querySelectorAll(
          '[data-testid="tablet-field-goal-area"]'
        ).length
      ).toBe(2);
    });

    it('zeichnet das Kleinfeld 28 x 16 m und rechnet die Tippstelle gleich um', async () => {
      fixture.componentRef.setInput('fieldSize', 'KF');
      await start();
      expect(field().getAttribute('data-field-size')).toBe('KF');
      expect(field().getAttribute('viewBox')).toBe('0 0 28 16');
      expect(field().style.aspectRatio).toBe('28 / 16');

      // Seitenverhältnis 1,75 : 1 auf dem Bildschirm
      const rect = field().getBoundingClientRect();
      expect(rect.width / rect.height).toBeCloseTo(1.75, 1);

      const at = {
        clientX: rect.left + rect.width * 0.8,
        clientY: rect.top + rect.height * 0.25,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        bubbles: true,
      };
      field().dispatchEvent(new PointerEvent('pointerdown', at));
      field().dispatchEvent(new PointerEvent('pointerup', at));
      render();
      // Die Marke vor der Wahl sitzt schon an der Tippstelle.
      const tapRing = fixture.nativeElement.querySelector(
        '[data-testid="tablet-tap-marker"] circle'
      ) as SVGCircleElement;
      expect(Number(tapRing.getAttribute('cx'))).toBeCloseTo(0.8 * 28, 1);
      fixture.nativeElement
        .querySelector('[data-testid="tablet-choice-shot"]')
        .click();
      render();

      const draft = component.draft!;
      expect(draft.screenX).toBeCloseTo(0.8, 2);
      expect(draft.screenY).toBeCloseTo(0.25, 2);
      expect(draft.team).toBe('home');
      // Markierung sitzt in Metern des Kleinfelds an der Tippstelle
      const marker = fixture.nativeElement.querySelector(
        '[data-testid="tablet-draft-marker"]'
      ) as SVGCircleElement;
      expect(Number(marker.getAttribute('cx'))).toBeCloseTo(0.8 * 28, 1);
      expect(Number(marker.getAttribute('cy'))).toBeCloseTo(0.25 * 16, 1);

      component.setDraftResult('saved');
      component.saveDraft();
      const request = http.expectOne(API + 'games/4711/shots.json');
      const sent = request.request.body.shots as ShotInput[];
      // Normierung bleibt 0..1 von Bande zu Bande, unabhängig von der Größe
      expect(sent[0].x).toBeCloseTo(0.8, 2);
      expect(sent[0].y).toBeCloseTo(0.25, 2);
      request.flush({ shots: [asShot(sent[0])] });
      await settle();
    });
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
    render();

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
    render();
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
    render();
    http.expectOne(API + 'games/4711/shots.json').flush({ shots: [shot] });
    render();
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
    render();
    http.expectOne(API + 'games/4711/shots.json').flush({ shots: [shot] });
    render();

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
      render();
    }

    function query(testId: string): HTMLElement | null {
      return fixture.nativeElement.querySelector(
        `[data-testid="${testId}"]`
      ) as HTMLElement | null;
    }

    it('startet im Abschnitt des Spiels, in der Pause schon im nächsten', async () => {
      await start(inPeriod(4711, 1.5));
      expect(component.viewPeriod).toBe(2);
      expect(component.followsGame).toBeTrue();
      expect(query('tablet-period-deviates')).toBeNull();
    });

    it('bleibt nach dem letzten Abschnitt in diesem, ohne spielbaren nächsten', async () => {
      // Drei Drittel, keine Verlängerung: 3.5 rundet nicht auf einen
      // Abschnitt, den es nicht gibt.
      await start(inPeriod(4711, 3));
      reload(inPeriod(4711, 3.5));
      expect(component.viewPeriod).toBe(3);
    });

    it('wechselt mit, wenn ein anderes Gerät den Abschnitt weiterschaltet', async () => {
      await start(inPeriod(4711, 1));
      reload(inPeriod(4711, 1.5));
      // Mit „Drittelpause beginnt“ steht die Erfassung schon im 2. Drittel.
      expect(component.viewPeriod).toBe(2);
      reload(inPeriod(4711, 2));
      expect(component.viewPeriod).toBe(2);
      expect(component.gamePeriod).toBe(2);
      expect(component.followsGame).toBeTrue();
    });

    it('lässt eine Handauswahl stehen, bis sich der Spielabschnitt ändert', async () => {
      await start(inPeriod(4711, 2));
      component.selectViewPeriod(1);
      render();
      expect(query('tablet-period-deviates')).not.toBeNull();

      // Nachladen ohne Abschnittswechsel: Nachtrag bleibt im 1. Abschnitt.
      reload(inPeriod(4711, 2, { audience: 120 } as Partial<Game>));
      expect(component.viewPeriod).toBe(1);

      reload(inPeriod(4711, 3));
      expect(component.viewPeriod).toBe(3);
      render();
      expect(query('tablet-period-deviates')).toBeNull();
    });

    it('führt zurück zum Spielabschnitt per Knopf', async () => {
      await start(inPeriod(4711, 2));
      component.selectViewPeriod(1);
      render();
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
      render();
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

  describe('Freischläge (fe#589)', () => {
    const T0 = Date.UTC(2026, 9, 16, 12, 0, 0);

    function tapAt(x: number, y: number): void {
      const field = fixture.nativeElement.querySelector(
        '[data-testid="tablet-field"]'
      ) as SVGElement;
      const rect = field.getBoundingClientRect();
      const at = {
        clientX: rect.left + rect.width * x,
        clientY: rect.top + rect.height * y,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        bubbles: true,
      };
      field.dispatchEvent(new PointerEvent('pointerdown', at));
      field.dispatchEvent(new PointerEvent('pointerup', at));
      render();
    }

    function click(testId: string): void {
      fixture.nativeElement
        .querySelector('[data-testid="' + testId + '"]')
        .click();
      render();
    }

    it('speichert einen Freischlag nach Tipp und Wahl mit Stelle und Tippzeitpunkt', async () => {
      await start();
      // 1. Abschnitt: Heim greift nach rechts an.
      component.tapField(0.75, 0.25, T0);
      component.chooseTapFreeHit('home');

      expect(component.pendingTap).toBeNull();
      expect(component.draft).toBeNull();
      const post = http.expectOne(API + 'games/4711/shots.json');
      const sent = post.request.body.shots as ShotInput[];
      expect(sent).toEqual([
        jasmine.objectContaining({
          kind: 'free_hit',
          team: 'home',
          period: 1,
          game_time: '',
          tapped_at: new Date(T0).toISOString(),
          x: 0.75,
          y: 0.25,
          result: null,
          shooter_player_id: null,
          goalkeeper_player_id: null,
          from_free_hit: false,
        }),
      ]);
      post.flush({ shots: [asShot(sent[0])] });
      await settle();
      render();

      expect(
        fixture.nativeElement.querySelectorAll(
          '[data-testid="tablet-free-hit-marker"]'
        ).length
      ).toBe(1);
      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-tap-marker"]')
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-last-free-hit"]'
        )
      ).toBeTruthy();
      expect(component.lastFreeHit!.team).toBe('home');
    });

    it('legt über die Knöpfe einen Freischlag des gewählten Teams an, auch in dessen eigener Hälfte', async () => {
      await start();
      // Heim greift im 1. Abschnitt nach rechts an; die linke Hälfte ist
      // Heims Verteidigungszone. Die Feldhälfte ergäbe hier Gast.
      tapAt(0.25, 0.5);
      expect(component.pendingTap!.team).toBe('guest');
      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-tap-marker"]')
      ).toBeTruthy();
      click('tablet-choice-free-hit-home');

      expect(component.draft).toBeNull();
      const sent = http.expectOne(API + 'games/4711/shots.json').request.body
        .shots as ShotInput[];
      expect(sent[0].kind).toBe('free_hit');
      expect(sent[0].team).toBe('home');
      expect(sent[0].x).toBeCloseTo(0.25, 2);
      expect(freeHitZone({ x: sent[0].x!, y: sent[0].y! })).toBe('own_half');
    });

    it('speichert einen Freischlag des Gastes über seinen Knopf', async () => {
      await start();
      tapAt(0.8, 0.5);
      click('tablet-choice-free-hit-guest');

      const sent = http.expectOne(API + 'games/4711/shots.json').request.body
        .shots as ShotInput[];
      expect(sent[0].kind).toBe('free_hit');
      expect(sent[0].team).toBe('guest');
      // Gast greift im 1. Abschnitt nach links an: Position gedreht.
      expect(sent[0].x).toBeCloseTo(0.2, 2);
    });

    it('bietet keine Scharf-Knöpfe für Freischläge mehr an', async () => {
      await start();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid^="tablet-free-hit-arm"]'
        )
      ).toBeNull();
    });

    it('zeigt die Rückmeldung zum Freischlag auch bei offenem Schuss-Entwurf', async () => {
      await start();
      tapAt(0.8, 0.5);
      click('tablet-choice-shot');
      expect(component.draft).toBeTruthy();
      // Das Verschiebe-Fenster ist vorbei: Der nächste Tipp ist eine neue
      // Szene, der Entwurf wartet.
      component.draft!.tapped_device_ms = Date.now() - 60000;
      tapAt(0.3, 0.3);
      expect(component.pendingTap).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-draft"]')
      ).toBeNull();
      click('tablet-choice-free-hit-guest');
      http.expectOne(API + 'games/4711/shots.json');

      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-draft"]')
      ).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-last-free-hit"]'
        )
      ).toBeTruthy();
      click('tablet-free-hit-undo');
      expect(component.lastFreeHit).toBeNull();
      expect(component.allShots.length).toBe(0);
      expect(component.draft).toBeTruthy();
    });

    it('lässt einen offenen Schuss-Entwurf beim Freischlag unangetastet', async () => {
      await start();
      component.startDraft(0.8, 0.5, T0);
      const draft = component.draft;
      component.tapField(0.3, 0.3, T0 + 30000);
      component.chooseTapFreeHit('guest');
      http.expectOne(API + 'games/4711/shots.json');

      expect(component.draft).toBe(draft);
      expect(component.draft!.screenX).toBe(0.8);
    });

    it('schreibt den letzten Freischlag dem anderen Team zu und rechnet die Position um', async () => {
      await start();
      component.recordFreeHit('home', 0.75, 0.25, T0);
      const first = http.expectOne(API + 'games/4711/shots.json');
      first.flush({ shots: [asShot(first.request.body.shots[0])] });
      await settle();
      const uuid = component.lastFreeHit!.client_uuid;

      component.swapLastFreeHitTeam();

      const sent = http.expectOne(API + 'games/4711/shots.json').request.body
        .shots as ShotInput[];
      const swapped = sent.find((shot) => shot.client_uuid === uuid)!;
      // Gast greift im 1. Abschnitt nach links an: Position gedreht.
      expect(swapped.team).toBe('guest');
      expect(swapped.x).toBeCloseTo(0.25, 5);
      expect(swapped.y).toBeCloseTo(0.75, 5);
      expect(swapped.tapped_at).toBe(new Date(T0).toISOString());
      expect(component.lastFreeHit!.team).toBe('guest');
    });

    it('nimmt den letzten Freischlag zurück', async () => {
      await start();
      component.recordFreeHit('home', 0.75, 0.25, T0);
      http.expectOne(API + 'games/4711/shots.json');

      component.undoLastFreeHit();

      expect(component.lastFreeHit).toBeNull();
      expect(component.allShots.length).toBe(0);
    });

    it('belegt „aus Freischlag“ vor, wenn derselbe Team-Freischlag höchstens 10 s zurückliegt', async () => {
      await start();
      component.recordFreeHit('home', 0.75, 0.25, T0);
      http.expectOne(API + 'games/4711/shots.json');

      component.startDraft(0.9, 0.5, T0 + 8000);
      expect(component.draft!.team).toBe('home');
      expect(component.draft!.from_free_hit).toBeTrue();

      // Das andere Team hatte keinen Freischlag.
      component.setDraftTeam('guest');
      expect(component.draft!.from_free_hit).toBeFalse();
    });

    it('belegt nicht vor, wenn der Freischlag länger als 10 s zurückliegt', async () => {
      await start();
      component.recordFreeHit('home', 0.75, 0.25, T0);
      http.expectOne(API + 'games/4711/shots.json');

      component.startDraft(0.9, 0.5, T0 + 11000);
      expect(component.draft!.from_free_hit).toBeFalse();
    });

    it('sendet den Schalter „aus Freischlag“ mit dem Schuss und behält eine Handauswahl', async () => {
      await start();
      component.recordFreeHit('home', 0.75, 0.25, T0);
      const first = http.expectOne(API + 'games/4711/shots.json');
      first.flush({ shots: [asShot(first.request.body.shots[0])] });
      await settle();

      component.startDraft(0.9, 0.5, T0 + 3000);
      component.toggleDraftFromFreeHit();
      // Von Hand abgewählt: Teamwechsel hin und zurück belegt nicht neu vor.
      component.setDraftTeam('guest');
      component.setDraftTeam('home');
      expect(component.draft!.from_free_hit).toBeFalse();
      component.toggleDraftFromFreeHit();
      component.setDraftResult('goal');
      component.saveDraft();

      const sent = http.expectOne(API + 'games/4711/shots.json').request.body
        .shots as ShotInput[];
      const shot = sent.find((entry) => entry.kind === 'shot')!;
      expect(shot.result).toBe('goal');
      expect(shot.from_free_hit).toBeTrue();
    });

    it('korrigiert einen Freischlag ohne Ergebnis und ohne Personen', async () => {
      await start();
      component.recordFreeHit('home', 0.75, 0.25, T0);
      const first = http.expectOne(API + 'games/4711/shots.json');
      const sent = first.request.body.shots as ShotInput[];
      first.flush({ shots: [asShot(sent[0])] });
      await settle();

      component.editShot(component.allShots[0]);
      render();
      expect(component.draft!.kind).toBe('free_hit');
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-result-goal"]'
        )
      ).toBeNull();
      expect(component.canSaveDraft).toBeTrue();

      component.draft!.game_time = '5:00';
      component.saveDraft();

      const second = http.expectOne(API + 'games/4711/shots.json');
      expect(second.request.body.shots[0]).toEqual(
        jasmine.objectContaining({
          client_uuid: sent[0].client_uuid,
          kind: 'free_hit',
          game_time: '5:00',
          result: null,
          shooter_player_id: null,
          goalkeeper_player_id: null,
          from_free_hit: false,
        })
      );
    });

    it('bietet einen Freischlag nicht zur Tor-Zuordnung an', async () => {
      const goal = {
        event_id: 900,
        event_type: 'goal',
        event_team: 'home',
        period: 1,
        time: '01:00',
        home_goals: 1,
        guest_goals: 0,
      };
      fixture.componentRef.setInput(
        'game',
        game(4711, { events: [goal] as unknown as Game['events'] })
      );
      render();
      const freeHit: Shot = {
        client_uuid: 'f1',
        kind: 'free_hit',
        team: 'home',
        period: 1,
        game_time: '',
        tapped_at: new Date(T0).toISOString(),
        x: 0.8,
        y: 0.5,
        result: null,
        id: 1,
        event_id: null,
      };
      http.expectOne(API + 'games/4711/shots.json').flush({ shots: [freeHit] });
      expect(component.linkCandidates).toEqual([]);
    });
  });

  describe('Szene vormerken (api#838)', () => {
    const T0 = Date.UTC(2026, 9, 16, 12, 0, 0);

    it('merkt mit einem Tipp den Moment vor, ohne Team und Position', async () => {
      await start(inPeriod(4711, 2));
      fixture.nativeElement
        .querySelector('[data-testid="tablet-mark-scene"]')
        .click();

      const post = http.expectOne(API + 'games/4711/shots.json');
      const sent = post.request.body.shots as ShotInput[];
      expect(sent).toEqual([
        jasmine.objectContaining({
          kind: 'mark',
          team: null,
          period: 2,
          game_time: '',
          x: null,
          y: null,
          result: null,
          shooter_player_id: null,
          goalkeeper_player_id: null,
          from_free_hit: false,
        }),
      ]);
      expect(component.draft).toBeNull();
      post.flush({ shots: [asShot(sent[0])] });
      await settle();
      render();

      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-last-mark"]')
      ).toBeTruthy();
      // Keine Markierung auf dem Feld, aber in der Liste der letzten Einträge.
      expect(component.fieldMarkers.length).toBe(0);
      expect(component.recentShots.length).toBe(1);
      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-recent"]')
          .textContent
      ).toContain('tablet.mark.label');
    });

    it('hält den Zeitpunkt des Tipps in Serverzeit fest', async () => {
      await start(game(4711), 60000);
      component.recordMark(T0);

      const sent = http.expectOne(API + 'games/4711/shots.json').request.body
        .shots as ShotInput[];
      const tapped = Date.parse(sent[0].tapped_at);
      expect(tapped).toBeGreaterThanOrEqual(T0 + 60000 - 1000);
      expect(tapped).toBeLessThanOrEqual(T0 + 60000 + 1000);
    });

    it('lässt einen offenen Schuss-Entwurf unangetastet', async () => {
      await start();
      component.startDraft(0.8, 0.5, T0);
      const draft = component.draft;
      component.recordMark(T0 + 1000);
      http.expectOne(API + 'games/4711/shots.json');

      expect(component.draft).toBe(draft);
    });

    it('nimmt die letzte vorgemerkte Szene zurück', async () => {
      await start();
      component.recordMark(T0);
      http.expectOne(API + 'games/4711/shots.json');

      component.undoLastMark();

      expect(component.lastMark).toBeNull();
      expect(component.allShots.length).toBe(0);
    });

    it('öffnet eine vorgemerkte Szene nicht zum Korrigieren', async () => {
      await start();
      component.recordMark(T0);
      http.expectOne(API + 'games/4711/shots.json');

      component.editShot(component.allShots[0]);

      expect(component.draft).toBeNull();
    });
  });

  describe('Strafschuss, Torwart raus, Paraden (Feedback #61 bis #64)', () => {
    const T0 = Date.UTC(2026, 9, 16, 12, 0, 0);

    function sentShots(): ShotInput[] {
      return http.expectOne(API + 'games/4711/shots.json').request.body
        .shots as ShotInput[];
    }

    // Methodenaufrufe markieren die Komponente nicht als geändert.
    function click(testId: string): void {
      fixture.nativeElement
        .querySelector('[data-testid="' + testId + '"]')
        .click();
      render();
    }

    it('bietet keinen Schnellzähler für Paraden mehr an', async () => {
      await start();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid^="tablet-quick-save"]'
        )
      ).toBeNull();
    });

    it('zeigt ältere Paraden ohne Position in der Liste, ohne Feldmarke, und löscht sie', async () => {
      fixture.componentRef.setInput('game', inPeriod(4711, 2));
      render();
      const save: Shot = {
        client_uuid: 's1',
        kind: 'shot',
        team: 'home',
        period: 2,
        game_time: '',
        tapped_at: new Date(T0).toISOString(),
        x: null,
        y: null,
        result: 'saved',
        shooter_player_id: null,
        goalkeeper_player_id: 299,
        id: 1,
        event_id: null,
      };
      http.expectOne(API + 'games/4711/shots.json').flush({ shots: [save] });
      render();

      expect(component.fieldMarkers.length).toBe(0);
      expect(component.canEdit(component.allShots[0])).toBeFalse();
      const recent = fixture.nativeElement.querySelector(
        '[data-testid="tablet-recent"]'
      );
      expect(recent.textContent).toContain('tablet.save.label');
      expect(recent.textContent).not.toContain('tablet.recent.edit');

      component.deleteShot('s1');
      expect(component.allShots.length).toBe(0);
      const del = http.expectOne(API + 'games/4711/shots/s1.json');
      expect(del.request.method).toBe('DELETE');
      del.flush({ shots: [] });
      await settle();
    });

    it('belegt bei „Torwart raus“ leeres Tor und 6 gegen 5 vor, bis zum Abschnittsende', async () => {
      await start();
      click('tablet-goalie-pulled-guest');
      expect(component.isGoaliePulled('guest')).toBeTrue();

      // 1. Abschnitt: rechts greift Heim an, also aufs leere Tor des Gastes.
      component.startDraft(0.8, 0.5, T0);
      expect(component.draft!.team).toBe('home');
      expect(component.draft!.empty_net).toBeTrue();
      expect(component.draft!.extra_attacker).toBeFalse();
      expect(component.draft!.goalkeeper_player_id).toBeNull();

      // Der Gast schießt mit 6 gegen 5 auf den Heimtorhüter.
      component.setDraftTeam('guest');
      expect(component.draft!.empty_net).toBeFalse();
      expect(component.draft!.extra_attacker).toBeTrue();
      expect(component.draft!.goalkeeper_player_id).toBe(199);
      component.cancelDraft();

      // Der Schalter übersteht ein Neuladen, aber nicht den Abschnittswechsel.
      fixture.componentRef.setInput('game', inPeriod(4711, 2));
      render();
      expect(component.isGoaliePulled('guest')).toBeFalse();
    });

    it('merkt „Torwart raus“ je Spiel auf dem Gerät', async () => {
      await start();
      component.toggleGoaliePulled('home');
      expect(
        JSON.parse(localStorage.getItem('tablet_pulled_goalie_4711')!)
      ).toEqual({ home: 1 });

      component.toggleGoaliePulled('home');
      expect(component.isGoaliePulled('home')).toBeFalse();
    });

    it('sendet einen Tor-Schuss aufs leere Tor ohne Torhüter', async () => {
      await start();
      component.toggleGoaliePulled('guest');
      component.startDraft(0.8, 0.5, T0);
      component.setDraftResult('goal');
      component.saveDraft();

      expect(sentShots()[0]).toEqual(
        jasmine.objectContaining({
          team: 'home',
          result: 'goal',
          empty_net: true,
          extra_attacker: false,
          goalkeeper_player_id: null,
        })
      );
    });

    it('nimmt „leeres Tor“ zurück, wenn der Schuss gehalten wurde', async () => {
      await start();
      component.toggleGoaliePulled('guest');
      component.startDraft(0.8, 0.5, T0);
      component.setDraftResult('saved');

      expect(component.draft!.empty_net).toBeFalse();
      expect(component.draft!.goalkeeper_player_id).toBe(299);

      component.toggleDraftEmptyNet();
      expect(component.draft!.empty_net).toBeTrue();
      expect(component.draft!.result).toBeNull();
      expect(component.draft!.goalkeeper_player_id).toBeNull();
    });

    it('Strafschuss schließt Freischlag, Blocken und herausgenommenen Torhüter aus', async () => {
      await start();
      component.toggleGoaliePulled('home');
      component.toggleGoaliePulled('guest');
      component.startDraft(0.8, 0.5, T0);
      component.toggleDraftFromFreeHit();
      component.setDraftResult('blocked');
      expect(component.draft!.empty_net).toBeTrue();

      component.toggleDraftPenaltyShot();

      const draft = component.draft!;
      expect(draft.from_penalty_shot).toBeTrue();
      expect(draft.from_free_hit).toBeFalse();
      expect(draft.result).toBeNull();
      expect(draft.empty_net).toBeFalse();
      expect(draft.extra_attacker).toBeFalse();
      expect(draft.goalkeeper_player_id).toBe(299);

      component.setDraftResult('saved');
      component.saveDraft();
      expect(sentShots()[0]).toEqual(
        jasmine.objectContaining({
          result: 'saved',
          from_penalty_shot: true,
          from_free_hit: false,
          empty_net: false,
          extra_attacker: false,
          goalkeeper_player_id: 299,
        })
      );
    });

    it('hebt die Torhüterwahl mit erneutem Tippen auf: Torhüter unbekannt, nicht leeres Tor', async () => {
      await start();
      component.startDraft(0.8, 0.5, T0);
      render();
      expect(component.draft!.goalkeeper_player_id).toBe(299);
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-goalkeeper-unknown"]'
        )
      ).toBeNull();

      component.setDraftGoalkeeper(299);
      render();

      expect(component.draft!.goalkeeper_player_id).toBeNull();
      expect(component.draft!.empty_net).toBeFalse();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-goalkeeper-unknown"]'
        )
      ).toBeTruthy();

      component.setDraftResult('saved');
      component.saveDraft();
      expect(sentShots()[0]).toEqual(
        jasmine.objectContaining({
          goalkeeper_player_id: null,
          empty_net: false,
        })
      );
    });

    it('schaltet „Torwart raus“ nur im laufenden Abschnitt', async () => {
      await start(inPeriod(4711, 2));
      component.selectViewPeriod(1);
      render();

      const toggle = fixture.nativeElement.querySelector(
        '[data-testid="tablet-goalie-pulled-guest"]'
      ) as HTMLButtonElement;
      expect(toggle.disabled).toBeTrue();
      component.toggleGoaliePulled('guest');
      expect(component.pulledGoalies).toEqual({});

      component.followGamePeriod();
      render();
      click('tablet-goalie-pulled-guest');
      expect(component.pulledGoalies).toEqual({ guest: 2 });
      expect(component.isGoaliePulled('guest')).toBeTrue();

      // Ein Nachtrag im 1. Abschnitt sieht den Schalter nicht.
      component.selectViewPeriod(1);
      expect(component.isGoaliePulled('guest')).toBeFalse();
      component.startDraft(0.8, 0.5, T0);
      expect(component.draft!.empty_net).toBeFalse();
    });

    it('übernimmt die Kennungen beim Korrigieren', async () => {
      await start();
      component.startDraft(0.8, 0.5, T0);
      component.setDraftResult('goal');
      component.toggleDraftExtraAttacker();
      component.saveDraft();
      const sent = sentShots();

      component.editShot(component.allShots[0]);

      expect(sent[0].extra_attacker).toBeTrue();
      expect(component.draft!.extra_attacker).toBeTrue();
      expect(component.draft!.from_penalty_shot).toBeFalse();
    });
  });

  describe('Erst tippen, dann wählen', () => {
    const T0 = Date.UTC(2026, 9, 16, 12, 0, 0);

    function click(testId: string): void {
      fixture.nativeElement
        .querySelector('[data-testid="' + testId + '"]')
        .click();
      render();
    }

    it('hält beim Tipp Stelle und Zeitpunkt fest und zeigt die Wahl', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      render();

      expect(component.draft).toBeNull();
      expect(component.pendingTap).toEqual({
        tapped_device_ms: T0,
        screenX: 0.8,
        screenY: 0.5,
        team: 'home',
        period: 1,
      });
      const choice = fixture.nativeElement.querySelector(
        '[data-testid="tablet-tap-choice"]'
      );
      expect(choice).toBeTruthy();
      expect(choice.textContent).toContain('tablet.choice.shot');
      // Noch nichts gespeichert.
      http.expectNone(API + 'games/4711/shots.json');
    });

    it('führt mit „Schuss“ in den Entwurf, mit dem ursprünglichen Tippzeitpunkt', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      render();
      click('tablet-choice-shot');

      expect(component.pendingTap).toBeNull();
      const draft = component.draft!;
      expect(draft.team).toBe('home');
      expect(draft.tapped_device_ms).toBe(T0);
      expect(draft.tapped_at).toBe(new Date(T0).toISOString());
      expect(draft.goalkeeper_player_id).toBe(299);
      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-draft"]')
      ).toBeTruthy();

      component.setDraftResult('missed');
      component.saveDraft();
      const sent = http.expectOne(API + 'games/4711/shots.json').request.body
        .shots as ShotInput[];
      expect(sent[0].kind).toBe('shot');
      expect(sent[0].tapped_at).toBe(new Date(T0).toISOString());
    });

    it('nimmt mit dem zweiten Schuss-Knopf das andere Team', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      render();
      click('tablet-choice-shot-other');

      expect(component.draft!.team).toBe('guest');
      // Heim verteidigt: dessen Torhüter.
      expect(component.draft!.goalkeeper_player_id).toBe(199);
      expect(component.draft!.tapped_device_ms).toBe(T0);
    });

    it('verwirft mit „Abbrechen“ Stelle und Zeitpunkt', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      render();
      click('tablet-choice-cancel');

      expect(component.pendingTap).toBeNull();
      expect(component.draft).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-tap-marker"]')
      ).toBeNull();
      expect(component.allShots.length).toBe(0);
      http.expectNone(API + 'games/4711/shots.json');
    });

    it('verschiebt bei erneutem Tippen nur die Stelle, der Zeitpunkt bleibt', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      component.tapField(0.3, 0.4, T0 + 5000);

      expect(component.pendingTap!.tapped_device_ms).toBe(T0);
      expect(component.pendingTap!.screenX).toBe(0.3);
      expect(component.pendingTap!.screenY).toBe(0.4);
      // Der Vorschlag folgt der neuen Feldhälfte.
      expect(component.pendingTap!.team).toBe('guest');

      component.chooseTapShot();
      expect(component.draft!.tapped_at).toBe(new Date(T0).toISOString());
      expect(component.draft!.screenX).toBe(0.3);
    });

    it('beginnt nach dem Verschiebe-Fenster eine neue Szene mit neuem Zeitpunkt', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      component.tapField(0.3, 0.4, T0 + 11000);

      expect(component.pendingTap!.tapped_device_ms).toBe(T0 + 11000);
    });

    it('verschiebt einen frischen Entwurf weiter, ohne neue Wahl', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      component.chooseTapShot();
      const uuid = component.draft!.client_uuid;
      component.tapField(0.7, 0.4, T0 + 4000);

      expect(component.pendingTap).toBeNull();
      expect(component.draft!.client_uuid).toBe(uuid);
      expect(component.draft!.screenX).toBe(0.7);
      expect(component.draft!.tapped_device_ms).toBe(T0);
    });

    it('belegt „aus Freischlag“ beim Schuss nach einem Freischlag vor', async () => {
      await start();
      component.tapField(0.75, 0.25, T0);
      component.chooseTapFreeHit('home');
      http.expectOne(API + 'games/4711/shots.json');

      component.tapField(0.9, 0.5, T0 + 3000);
      component.chooseTapShot();
      expect(component.draft!.team).toBe('home');
      expect(component.draft!.from_free_hit).toBeTrue();
      // Der Freischlag ist gespeichert, seine Raute steht auf dem Feld.
      expect(component.fieldMarkers.filter((m) => m.freeHit).length).toBe(1);
    });

    it('wartet mit dem Abschnittswechsel, solange gewählt wird', async () => {
      await start(inPeriod(4711, 1));
      component.tapField(0.8, 0.5, T0);
      fixture.componentRef.setInput('game', inPeriod(4711, 2));
      render();

      expect(component.viewPeriod).toBe(1);
      expect(component.periodChangePending).toBeTrue();
      component.cancelTap();
      expect(component.viewPeriod).toBe(2);
      expect(component.periodChangePending).toBeFalse();
    });

    it('ersetzt einen über 10 s alten Entwurf, der neue trägt den Zeitpunkt des Tipps', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      component.chooseTapShot();
      const old = component.draft!;

      component.tapField(0.3, 0.4, T0 + 20000);
      // Der alte Entwurf wartet, solange gewählt wird.
      expect(component.draft).toBe(old);
      expect(component.pendingTap!.tapped_device_ms).toBe(T0 + 20000);
      component.chooseTapShot();

      expect(component.draft!.client_uuid).not.toBe(old.client_uuid);
      expect(component.draft!.tapped_device_ms).toBe(T0 + 20000);
      expect(component.draft!.tapped_at).toBe(
        new Date(T0 + 20000).toISOString()
      );
      expect(component.draft!.screenX).toBe(0.3);
      expect(component.draft!.team).toBe('guest');
    });

    it('ersetzt einen offenen Tipp nach dem Fenster durch einen neuen mit neuem Zeitpunkt', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      component.tapField(0.2, 0.6, T0 + 10001);

      expect(component.pendingTap).toEqual({
        tapped_device_ms: T0 + 10001,
        screenX: 0.2,
        screenY: 0.6,
        team: 'guest',
        period: 1,
      });
      component.chooseTapFreeHit('guest');
      const sent = http.expectOne(API + 'games/4711/shots.json').request.body
        .shots as ShotInput[];
      expect(sent.length).toBe(1);
      expect(sent[0].tapped_at).toBe(new Date(T0 + 10001).toISOString());
    });

    it('rechnet den Teamvorschlag nach „Seiten tauschen“ neu', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      expect(component.pendingTap!.team).toBe('home');
      render();
      click('tablet-swap-sides');

      expect(component.pendingTap!.team).toBe('guest');
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-choice-shot"]'
        ).textContent
      ).toContain('tablet.choice.shot');
      component.chooseTapShot();
      expect(component.draft!.team).toBe('guest');
      expect(component.draft!.tapped_device_ms).toBe(T0);
    });

    it('verwirft die Wahl beim Spielwechsel', async () => {
      await start();
      component.tapField(0.8, 0.5, T0);
      fixture.componentRef.setInput('game', game(4712));
      render();
      http.expectOne(API + 'games/4712/shots.json').flush({ shots: [] });

      expect(component.pendingTap).toBeNull();
    });
  });

  describe('Vollbild', () => {
    function root(): HTMLElement {
      return fixture.nativeElement.querySelector(
        '[data-testid="tablet-capture"]'
      ) as HTMLElement;
    }

    function toggle(): HTMLButtonElement {
      return fixture.nativeElement.querySelector(
        '[data-testid="tablet-fullscreen-toggle"]'
      ) as HTMLButtonElement;
    }

    afterEach(() => {
      document.body.style.overflow = '';
    });

    it('ist aus und legt sich auf Knopfdruck als Ebene über die Seite', async () => {
      await start();
      const request = spyOn(root(), 'requestFullscreen').and.returnValue(
        Promise.resolve()
      );
      expect(component.fullscreen).toBeFalse();
      expect(root().classList).not.toContain('fixed');
      expect(toggle().getAttribute('aria-pressed')).toBe('false');

      toggle().click();
      render();

      expect(component.fullscreen).toBeTrue();
      expect(root().classList).toContain('fixed');
      expect(root().classList).toContain('inset-0');
      expect(root().getAttribute('role')).toBe('dialog');
      expect(document.body.style.overflow).toBe('hidden');
      expect(request).toHaveBeenCalled();
      expect(toggle().textContent).toContain('tablet.fullscreen.exit');
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
      expect(
        fixture.nativeElement.querySelector('[data-testid="tablet-body"]')
          .classList
      ).toContain('tc-fs-body');

      toggle().click();
      render();
      expect(component.fullscreen).toBeFalse();
      expect(root().classList).not.toContain('fixed');
      expect(document.body.style.overflow).toBe('');
    });

    it('beendet das Vollbild mit Esc', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.returnValue(Promise.resolve());
      component.enterFullscreen();
      render();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      render();

      expect(component.fullscreen).toBeFalse();
      expect(root().classList).not.toContain('fixed');
      expect(document.body.style.overflow).toBe('');
    });

    it('bleibt bei der Ebene, wenn der Browser das Vollbild ablehnt', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.returnValue(
        Promise.reject(new Error('denied'))
      );
      component.enterFullscreen();
      await settle();
      render();

      expect(component.fullscreen).toBeTrue();
      expect(root().classList).toContain('fixed');
    });

    it('bleibt bei der Ebene, wenn die Fullscreen-API wirft oder fehlt', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.throwError('not supported');
      expect(() => component.enterFullscreen()).not.toThrow();
      expect(component.fullscreen).toBeTrue();
      component.exitFullscreen();

      (root() as unknown as { requestFullscreen: unknown }).requestFullscreen =
        undefined;
      component.enterFullscreen();
      render();
      expect(component.fullscreen).toBeTrue();
      expect(root().classList).toContain('fixed');
    });

    it('beendet die Ebene mit, wenn das Browser-Vollbild verlassen wird', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.returnValue(Promise.resolve());
      const exit = spyOn(document, 'exitFullscreen').and.returnValue(
        Promise.resolve()
      );
      const current = spyOnProperty(
        document,
        'fullscreenElement',
        'get'
      ).and.returnValue(null);
      component.enterFullscreen();

      // Ein fremdes Vollbild-Ende vor dem eigenen zählt nicht.
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(component.fullscreen).toBeTrue();

      current.and.returnValue(root());
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(component.fullscreen).toBeTrue();

      // Esc im Browser-Vollbild erreicht die Seite nicht, nur dieses Ereignis.
      current.and.returnValue(null);
      document.dispatchEvent(new Event('fullscreenchange'));
      render();
      expect(component.fullscreen).toBeFalse();
      expect(root().classList).not.toContain('fixed');
      expect(exit).not.toHaveBeenCalled();
    });

    it('verlässt beim Beenden per Knopf auch das Browser-Vollbild', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.returnValue(Promise.resolve());
      const exit = spyOn(document, 'exitFullscreen').and.returnValue(
        Promise.reject(new Error('egal'))
      );
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(
        root()
      );
      component.enterFullscreen();
      document.dispatchEvent(new Event('fullscreenchange'));

      component.exitFullscreen();
      await settle();
      expect(exit).toHaveBeenCalled();
      expect(component.fullscreen).toBeFalse();
    });

    it('gibt die Seite beim Zerstören wieder frei', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.returnValue(Promise.resolve());
      component.enterFullscreen();
      expect(document.body.style.overflow).toBe('hidden');

      fixture.destroy();
      expect(document.body.style.overflow).toBe('');
    });

    it('baut Feedback und Highlights beim Umschalten nicht neu auf', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.returnValue(Promise.resolve());
      const feedback = () =>
        fixture.debugElement.query(By.directive(TabletFeedbackComponent))
          .componentInstance as TabletFeedbackComponent;
      const highlight = () =>
        fixture.debugElement.query(
          By.directive(TabletHighlightRequestComponent)
        ).componentInstance;
      const firstFeedback = feedback();
      const firstHighlight = highlight();
      fixture.nativeElement
        .querySelector('[data-testid="tablet-feedback-toggle"]')
        .click();
      render();
      await fixture.whenStable();
      const textarea = () =>
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-feedback-message"]'
        ) as HTMLTextAreaElement;
      textarea().value = 'Spielfeld endlich groß';
      textarea().dispatchEvent(new Event('input'));
      render();
      expect(feedback().message).toBe('Spielfeld endlich groß');

      component.toggleFullscreen();
      render();
      expect(feedback()).toBe(firstFeedback);
      component.toggleFullscreen();
      render();

      expect(feedback()).toBe(firstFeedback);
      expect(highlight()).toBe(firstHighlight);
      expect(feedback().message).toBe('Spielfeld endlich groß');
      expect(textarea().value).toBe('Spielfeld endlich groß');
    });

    it('spiegelt Meldungen der Seite nur im Browser-Vollbild', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.returnValue(Promise.resolve());
      spyOn(document, 'exitFullscreen').and.returnValue(Promise.resolve());
      const current = spyOnProperty(
        document,
        'fullscreenElement',
        'get'
      ).and.returnValue(null);
      const notifications = TestBed.inject(NotificationService);
      const notices = () =>
        fixture.nativeElement.querySelectorAll(
          '[data-testid="tablet-fullscreen-notices"] li'
        );

      // Nur die Ebene: Die Meldungen der Seite liegen darüber.
      component.enterFullscreen();
      notifications.error('Vorher');
      render();
      expect(notices().length).toBe(0);

      current.and.returnValue(root());
      document.dispatchEvent(new Event('fullscreenchange'));
      notifications.error('Keine Verbindung');
      notifications.error('Keine Verbindung');
      render();
      expect(notices().length).toBe(1);
      expect(notices()[0].textContent).toContain('Keine Verbindung');

      notifications.dismiss('Keine Verbindung');
      render();
      expect(notices().length).toBe(0);

      notifications.warning('Noch eine');
      render();
      notices()[0].querySelector('button').click();
      render();
      expect(notices().length).toBe(0);

      notifications.error('Zum Schluss');
      component.exitFullscreen();
      render();
      expect(component.fullscreenNotices).toEqual([]);
    });

    it('erfasst im Vollbild wie gewohnt: Tipp, Wahl, Entwurf', async () => {
      await start();
      spyOn(root(), 'requestFullscreen').and.returnValue(Promise.resolve());
      toggle().click();
      render();

      const field = fixture.nativeElement.querySelector(
        '[data-testid="tablet-field"]'
      ) as SVGElement;
      const rect = field.getBoundingClientRect();
      expect(rect.width).toBeGreaterThan(0);
      const at = {
        clientX: rect.left + rect.width * 0.75,
        clientY: rect.top + rect.height * 0.5,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        bubbles: true,
      };
      field.dispatchEvent(new PointerEvent('pointerdown', at));
      field.dispatchEvent(new PointerEvent('pointerup', at));
      render();
      fixture.nativeElement
        .querySelector('[data-testid="tablet-choice-shot"]')
        .click();
      render();

      expect(component.draft!.screenX).toBeCloseTo(0.75, 2);
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-side"] [data-testid="tablet-draft"]'
        )
      ).toBeTruthy();
    });
  });
});
