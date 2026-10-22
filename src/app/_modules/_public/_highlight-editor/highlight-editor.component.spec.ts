import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import {
  YoutubeIframeApiService,
  YtPlayer,
  YtPlayerOptions,
  getTranslocoTestingModule,
} from '@floorball/core';
import { HighlightEditorData } from '@floorball/types';
import { environment } from 'src/environments/environment';

import { HighlightEditorComponent } from './highlight-editor.component';

const API = environment.apiURL;
const TOKEN_PATH = API + 'highlight_editor.json?token=abc';
const GAME_PATH = API + 'games/4711/highlight_editor.json';

function data(
  overrides: Partial<HighlightEditorData> = {}
): HighlightEditorData {
  return {
    game: {
      id: 4711,
      game_number: '12',
      home_team_name: 'Heim',
      guest_team_name: 'Gast',
    },
    video_id: 'vid123',
    offset_seconds: null,
    calibrated_at: null,
    calibration_scene: { client_uuid: 'tor', anchor_second: 600 },
    scenes: [
      {
        client_uuid: 'tor',
        kind: 'goal',
        label: '1:0 Müller',
        team: 'home',
        period: 1,
        game_time: '05:00',
        anchor_second: 600,
        start: 585,
        end: 605,
        in_highlights: true,
      },
      {
        client_uuid: 'chance',
        kind: 'mark',
        label: 'Vorgemerkte Szene',
        team: null,
        period: 2,
        game_time: '',
        anchor_second: 1500,
        start: 1485,
        end: 1505,
        in_highlights: true,
      },
    ],
    expires_at: '2026-11-05T12:00:00Z',
    ...overrides,
  };
}

describe('HighlightEditorComponent', () => {
  let fixture: ComponentFixture<HighlightEditorComponent>;
  let component: HighlightEditorComponent;
  let http: HttpTestingController;
  let query: Record<string, string>;
  let player: jasmine.SpyObj<YtPlayer>;
  let playerOptions: YtPlayerOptions | undefined;

  beforeEach(async () => {
    query = { token: 'abc' };
    playerOptions = undefined;
    player = jasmine.createSpyObj<YtPlayer>('YtPlayer', [
      'loadVideoById',
      'getCurrentTime',
      'pauseVideo',
      'destroy',
    ]);

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [HighlightEditorComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(query);
              },
            },
          },
        },
        {
          provide: YoutubeIframeApiService,
          useValue: {
            createPlayer: (_el: HTMLElement, options: YtPlayerOptions) => {
              playerOptions = options;
              return Promise.resolve(player);
            },
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HighlightEditorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  function el(test: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-test="${test}"]`);
  }

  function load(response: HighlightEditorData = data(), path = TOKEN_PATH) {
    fixture.detectChanges();
    http.expectOne(path).flush(response);
    fixture.detectChanges();
  }

  /** Zustimmung samt spielbereitem Player. */
  async function readyPlayer() {
    await component.consent();
    playerOptions!.events!.onReady!({ data: -1, target: player });
    fixture.detectChanges();
  }

  it('lädt über den Token aus dem Link und zeigt Kalibrierung und Szenen', () => {
    load();

    expect(component.state).toBe('ready');
    expect(el('editor-calibration')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('[data-test="editor-scene"]')
        .length
    ).toBe(2);
    // Vor der Zustimmung geht nichts an YouTube.
    expect(playerOptions).toBeUndefined();
  });

  it('lädt als Admin bzw. SBK über die Spiel-ID', () => {
    query = { spiel: '4711' };
    load(data({ expires_at: undefined }), GAME_PATH);

    expect(component.state).toBe('ready');
    expect(component.viaLink).toBeFalse();
  });

  it('zeigt einen unbekannten Link als ungültig', () => {
    fixture.detectChanges();
    http
      .expectOne(TOKEN_PATH)
      .flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(el('editor-invalid')).not.toBeNull();
  });

  it('zeigt einen abgelaufenen Link als abgelaufen', () => {
    fixture.detectChanges();
    http
      .expectOne(TOKEN_PATH)
      .flush({ message: 'x' }, { status: 410, statusText: 'Gone' });
    fixture.detectChanges();

    expect(el('editor-expired')).not.toBeNull();
  });

  it('fragt ohne Token und ohne Spiel gar nicht erst', () => {
    query = {};
    fixture.detectChanges();

    expect(component.state).toBe('invalid');
  });

  it('meldet, wenn es noch keine veröffentlichte Aufzeichnung gibt', () => {
    load(data({ video_id: null, scenes: [], calibration_scene: null }));

    expect(el('editor-no-video')).not.toBeNull();
    expect(el('editor-calibration')).toBeNull();
  });

  it('startet die Kalibrierszene 10 s vor dem Antippen, ohne Ende', async () => {
    load();
    component.playCalibration();
    await new Promise((resolve) => setTimeout(resolve));
    playerOptions!.events!.onReady!({ data: -1, target: player });

    expect(player.loadVideoById).toHaveBeenCalledWith({
      videoId: 'vid123',
      startSeconds: 590,
    });
    expect(component.playing).toBe('calibration');
  });

  it('setzt den Versatz mit „Jetzt fällt das Tor“ aus der Abspielposition', async () => {
    load();
    await readyPlayer();
    component.playCalibration();
    player.getCurrentTime.and.returnValue(623.4);

    component.markGoalNow();

    expect(component.offset).toBe(23);
    expect(player.pauseVideo).toHaveBeenCalled();
  });

  it('spielt Szenen mit dem noch nicht gespeicherten Versatz', async () => {
    load();
    await readyPlayer();
    component.adjustOffset(5);
    component.adjustOffset(1);

    component.playScene(component.scenes[1]);

    // Kalibriert: 12 s vor bis 8 s nach 1500 + 6.
    expect(player.loadVideoById).toHaveBeenCalledWith({
      videoId: 'vid123',
      startSeconds: 1494,
      endSeconds: 1514,
    });
  });

  it('speichert nur Versatz und geänderte Auswahl und übernimmt die Antwort', () => {
    load();
    component.offset = 22;
    component.toggleScene(component.scenes[1]);
    expect(component.dirty).toBeTrue();

    component.save();

    const req = http.expectOne(TOKEN_PATH);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      offset_seconds: 22,
      scenes: [{ client_uuid: 'chance', in_highlights: false }],
    });
    const saved = data({ offset_seconds: 22 });
    saved.scenes[1].in_highlights = false;
    req.flush(saved);
    fixture.detectChanges();

    expect(component.dirty).toBeFalse();
    expect(el('editor-saved')).not.toBeNull();
  });

  it('nimmt die Kalibrierung zurück', () => {
    load(data({ offset_seconds: 22 }));
    component.resetOffset();
    component.save();

    expect(http.expectOne(TOKEN_PATH).request.body).toEqual({
      offset_seconds: null,
    });
  });

  it('zeigt die Begründung der API, wenn Speichern abgewiesen wird', () => {
    query = { spiel: '4711' };
    load(data(), GAME_PATH);
    component.offset = 10;
    component.save();
    http
      .expectOne(GAME_PATH)
      .flush(
        {
          message:
            'Für dieses Spiel gibt es keine veröffentlichte Aufzeichnung.',
        },
        { status: 422, statusText: 'Unprocessable Entity' }
      );
    fixture.detectChanges();

    expect(el('editor-save-failed')!.textContent).toContain(
      'keine veröffentlichte Aufzeichnung'
    );
    expect(component.state).toBe('ready');
  });

  it('sperrt die Seite, wenn der Link beim Speichern abgelaufen ist', () => {
    load();
    component.offset = 10;
    component.save();
    http
      .expectOne(TOKEN_PATH)
      .flush({ message: 'x' }, { status: 410, statusText: 'Gone' });
    fixture.detectChanges();

    expect(el('editor-expired')).not.toBeNull();
  });
});
