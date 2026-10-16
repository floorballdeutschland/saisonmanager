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
import { MatchHighlightsComponent } from './match-highlights.component';

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
      endSeconds: 120,
    });
    expect(component.currentIndex).toBe(0);
  });

  it('spielt die Szenen nacheinander und hört nach der letzten auf', async () => {
    await consentAndReady();

    ended();
    expect(player.loadVideoById).toHaveBeenCalledWith(
      jasmine.objectContaining({ startSeconds: 400, endSeconds: 420 })
    );
    ended();
    expect(component.currentIndex).toBe(2);
    expect(player.loadVideoById).toHaveBeenCalledTimes(3);

    ended();
    expect(player.loadVideoById).toHaveBeenCalledTimes(3);
    expect(component.finished).toBeTrue();
  });

  it('springt aus der Liste zu einer Szene und spielt ab dort weiter', async () => {
    await consentAndReady();

    component.selectScene(2);
    expect(component.currentIndex).toBe(2);
    expect(player.loadVideoById).toHaveBeenCalledWith(
      jasmine.objectContaining({ startSeconds: 900 })
    );

    component.playAll();
    expect(component.currentIndex).toBe(0);
  });

  it('beginnt nach der Zustimmung mit der vorher gewählten Szene', async () => {
    component.jumpTo(1);
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
});
