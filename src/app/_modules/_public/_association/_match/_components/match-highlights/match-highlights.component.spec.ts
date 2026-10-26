import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  getTranslocoTestingModule,
  YoutubeIframeApiService,
  YT_STATE_ENDED,
  YtPlayer,
  YtPlayerOptions,
} from '@floorball/core';
import { HighlightScene, Highlights } from '@floorball/types';
import matchDe from '../../../../../../../assets/i18n/match/de.json';
import {
  MatchHighlightsComponent,
  PLAYER_READY_TIMEOUT_MS,
} from './match-highlights.component';

function scene(eventId: number, start: number): HighlightScene {
  return {
    event_id: eventId,
    start,
    end: start + 20,
    team: 'home',
    home_goals: eventId,
    guest_goals: 0,
    period: 1,
    game_time: '05:00',
    scorer: { trikot_number: 10, name: 'A. Schütze' },
    assist: { trikot_number: 7, name: 'B. Vorlage' },
  };
}

const highlights = (videoId = 'abc123'): Highlights => ({
  video_id: videoId,
  scenes: [scene(1, 100), scene(2, 400), scene(3, 900)],
});

describe('MatchHighlightsComponent', () => {
  let fixture: ComponentFixture<MatchHighlightsComponent>;
  let component: MatchHighlightsComponent;
  let youtube: jasmine.SpyObj<YoutubeIframeApiService>;
  let player: jasmine.SpyObj<YtPlayer>;
  let options: YtPlayerOptions | undefined;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    player = jasmine.createSpyObj<YtPlayer>('YtPlayer', [
      'loadVideoById',
      'seekTo',
      'playVideo',
      'pauseVideo',
      'getCurrentTime',
      'destroy',
    ]);
    youtube = jasmine.createSpyObj<YoutubeIframeApiService>(
      'YoutubeIframeApiService',
      ['createPlayer']
    );
    options = undefined;
    youtube.createPlayer.and.callFake(async (_el, opts) => {
      options = opts;
      return player;
    });

    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule({ de: { match: matchDe } })],
      declarations: [MatchHighlightsComponent],
      providers: [{ provide: YoutubeIframeApiService, useValue: youtube }],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchHighlightsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('highlights', highlights());
    fixture.detectChanges();
  });

  async function consentAndReady() {
    await component.consent();
    options?.events?.onReady?.({ data: 0, target: player });
    fixture.detectChanges();
  }

  const ended = () =>
    options?.events?.onStateChange?.({ data: YT_STATE_ENDED, target: player });

  /** Der Player steht bei `seconds`, die Endprüfung läuft. */
  const at = (seconds: number) => {
    player.getCurrentTime.and.returnValue(seconds);
    component.checkSceneEnd();
  };

  it('zeigt eine vorgemerkte Szene als „Szene“, ohne Spielstand und Schütze (api#838)', () => {
    const mark: HighlightScene = {
      kind: 'mark',
      event_id: null,
      start: 1500,
      end: 1520,
      team: null,
      period: 2,
      game_time: '',
    };
    fixture.componentRef.setInput('highlights', {
      ...highlights(),
      scenes: [scene(1, 100), mark],
    });
    fixture.detectChanges();

    const rows = el().querySelectorAll('[data-test="highlights-scene"]');
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain(matchDe.highlights.mark);
    expect(rows[1].textContent).not.toContain('undefined');
    expect(rows[1].textContent).not.toContain('Schütze');
  });

  describe('Kalibrierung', () => {
    const pending = () =>
      el().querySelector('[data-test="highlights-calibration-pending"]');

    it('zeigt „Kalibrierung ausstehend“, solange die Aufzeichnung unkalibriert ist', () => {
      fixture.componentRef.setInput('highlights', {
        ...highlights(),
        calibrated: false,
      });
      fixture.detectChanges();

      expect(pending()?.textContent?.trim()).toBe('Kalibrierung ausstehend');
    });

    it('zeigt nichts, wenn kalibriert oder das Feld fehlt (ältere API)', () => {
      expect(pending()).toBeNull();

      fixture.componentRef.setInput('highlights', {
        ...highlights(),
        calibrated: true,
      });
      fixture.detectChanges();
      expect(pending()).toBeNull();
    });
  });

  it('lädt vor dem Klick nichts von YouTube und zeigt den Hinweis', () => {
    expect(youtube.createPlayer).not.toHaveBeenCalled();
    expect(
      el().querySelector('[data-test="highlights-consent"]')?.textContent
    ).toContain('YouTube');
    expect(el().querySelectorAll('[data-test="highlights-scene"]').length).toBe(
      3
    );
    expect(el().querySelector('iframe')).toBeNull();
  });

  it('merkt sich vor der Zustimmung die gewählte Szene, ohne etwas zu laden', () => {
    el()
      .querySelectorAll<HTMLButtonElement>('[data-test="highlights-scene"]')[1]
      .click();

    expect(youtube.createPlayer).not.toHaveBeenCalled();
    expect(component.pendingIndex).toBe(1);
  });

  it('startet nach der Zustimmung mit der ersten Szene', async () => {
    el()
      .querySelector<HTMLButtonElement>(
        '[data-test="highlights-consent-button"]'
      )
      ?.click();
    await fixture.whenStable();
    options?.events?.onReady?.({ data: 0, target: player });

    expect(youtube.createPlayer).toHaveBeenCalledTimes(1);
    expect(player.loadVideoById).toHaveBeenCalledWith({
      videoId: 'abc123',
      startSeconds: 100,
    });
    expect(component.currentIndex).toBe(0);
  });

  it('spielt die Szenen nacheinander und hört nach der letzten auf', async () => {
    await consentAndReady();

    at(105);
    at(120);
    expect(component.currentIndex).toBe(1);
    expect(player.seekTo).toHaveBeenCalledWith(400, true);
    at(405);
    at(420);
    expect(component.currentIndex).toBe(2);
    expect(player.seekTo).toHaveBeenCalledWith(900, true);

    at(905);
    at(920);
    expect(component.finished).toBeTrue();
    expect(player.pauseVideo).toHaveBeenCalled();
    expect(player.seekTo).toHaveBeenCalledTimes(2);
    // Das Video wird nur einmal geladen, danach wird nur gesprungen.
    expect(player.loadVideoById).toHaveBeenCalledTimes(1);
  });

  it('wertet die alte Position vor dem Ankommen nicht als Szenenende (Spiel 58763)', async () => {
    await consentAndReady();
    at(105);
    at(120);

    // Der Sprung zu 400 ist noch nicht angekommen: 120 liegt vor der Szene.
    at(120);
    at(121);
    expect(component.currentIndex).toBe(1);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
  });

  it('beendet nach einem Sprung zurück die neue Szene nicht sofort', async () => {
    await consentAndReady();
    component.selectScene(2);
    at(905);

    component.selectScene(0);
    at(925);
    expect(component.currentIndex).toBe(0);

    at(101);
    at(120);
    expect(component.currentIndex).toBe(1);
  });

  it('schaltet auch weiter, wenn das Video selbst zu Ende ist', async () => {
    await consentAndReady();
    component.selectScene(2);

    ended();
    expect(component.finished).toBeTrue();
  });

  it('springt aus der Liste zu einer Szene und spielt ab dort weiter', async () => {
    await consentAndReady();

    component.selectScene(2);
    expect(component.currentIndex).toBe(2);
    expect(player.seekTo).toHaveBeenCalledWith(900, true);
    expect(player.playVideo).toHaveBeenCalled();

    component.playAll();
    expect(component.currentIndex).toBe(0);
  });

  it('beginnt nach der Zustimmung mit der vorher gewählten Szene', async () => {
    component.selectScene(1);
    await consentAndReady();

    expect(player.loadVideoById).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ startSeconds: 400 })
    );
  });

  it('meldet einen YouTube-Fehler nach außen und baut den Player ab', async () => {
    const unavailable = jasmine.createSpy('unavailable');
    component.unavailable.subscribe(unavailable);
    await consentAndReady();

    options?.events?.onError?.({ data: 150, target: player });

    expect(unavailable).toHaveBeenCalled();
    expect(player.destroy).toHaveBeenCalled();
  });

  it('setzt bei einem anderen Video (Spielwechsel) Player und Zustimmung zurück', async () => {
    await consentAndReady();

    fixture.componentRef.setInput('highlights', highlights('xyz789'));
    fixture.detectChanges();

    expect(player.destroy).toHaveBeenCalled();
    expect(component.consented).toBeFalse();
    expect(component.currentIndex).toBeNull();
    expect(el().querySelector('[data-test="highlights-consent"]')).toBeTruthy();
  });

  it('bietet einen neuen Versuch an, wenn die YouTube-API nicht lädt', async () => {
    youtube.createPlayer.and.rejectWith(new Error('offline'));

    await component.consent();
    fixture.detectChanges();

    expect(component.consented).toBeFalse();
    expect(component.loadFailed).toBeTrue();
    expect(el().querySelector('[role="alert"]')).toBeTruthy();
  });

  it('gibt nach der Zeitüberschreitung auf und bietet den Knopf wieder an', async () => {
    jasmine.clock().install();
    try {
      await component.consent();
      expect(component.loading).toBeTrue();

      jasmine.clock().tick(PLAYER_READY_TIMEOUT_MS);
      fixture.detectChanges();

      expect(component.loadFailed).toBeTrue();
      expect(component.consented).toBeFalse();
      expect(player.destroy).toHaveBeenCalled();
      expect(
        el().querySelector('[data-test="highlights-consent-button"]')
      ).toBeTruthy();

      // Ein spätes onReady des aufgegebenen Players spielt nichts mehr ab.
      options?.events?.onReady?.({ data: 0, target: player });
      expect(player.loadVideoById).not.toHaveBeenCalled();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  describe('Spielwechsel oder Abbau während des Ladens', () => {
    let resolvePlayer: (p: YtPlayer) => void;

    beforeEach(() => {
      youtube.createPlayer.and.callFake((_el, opts) => {
        options = opts;
        return new Promise<YtPlayer>((resolve) => (resolvePlayer = resolve));
      });
    });

    it('baut den verspätet fertigen Player des alten Videos ab', async () => {
      const loading = component.consent();
      fixture.componentRef.setInput('highlights', highlights('xyz789'));
      fixture.detectChanges();

      resolvePlayer(player);
      await loading;
      options?.events?.onReady?.({ data: 0, target: player });

      expect(player.destroy).toHaveBeenCalled();
      expect(player.loadVideoById).not.toHaveBeenCalled();
      expect(component.consented).toBeFalse();
      expect(component.loadFailed).toBeFalse();
    });

    it('baut den Player ab, wenn die Seite während des Ladens verlassen wird', async () => {
      const loading = component.consent();
      fixture.destroy();

      resolvePlayer(player);
      await loading;

      expect(player.destroy).toHaveBeenCalled();
    });

    it('meldet keinen Fehler, wenn ein veralteter Ladeversuch scheitert', async () => {
      let rejectPlayer: (e: Error) => void = () => undefined;
      youtube.createPlayer.and.callFake(
        () => new Promise<YtPlayer>((_r, reject) => (rejectPlayer = reject))
      );
      const loading = component.consent();
      fixture.componentRef.setInput('highlights', highlights('xyz789'));
      fixture.detectChanges();

      rejectPlayer(new Error('offline'));
      await loading;

      expect(component.loadFailed).toBeFalse();
    });
  });
});
