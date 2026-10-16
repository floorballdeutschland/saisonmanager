import { TestBed } from '@angular/core/testing';
import {
  YoutubeIframeApiService,
  YtPlayerOptions,
} from './youtube-iframe-api.service';

describe('YoutubeIframeApiService', () => {
  let service: YoutubeIframeApiService;
  let originalYT: Window['YT'];
  let originalReady: Window['onYouTubeIframeAPIReady'];

  beforeEach(() => {
    originalYT = window.YT;
    originalReady = window.onYouTubeIframeAPIReady;
    delete window.YT;
    delete window.onYouTubeIframeAPIReady;
    service = TestBed.inject(YoutubeIframeApiService);
  });

  afterEach(() => {
    window.YT = originalYT;
    window.onYouTubeIframeAPIReady = originalReady;
  });

  it('bindet das Skript erst beim ersten Aufruf ein, und nur einmal', async () => {
    // Nichts wirklich laden: Der Test soll keine Anfrage an YouTube stellen.
    const appended: HTMLScriptElement[] = [];
    spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(n: T) => {
      appended.push(n as unknown as HTMLScriptElement);
      return n;
    });

    const first = service.load();
    const second = service.load();
    expect(appended.length).toBe(1);
    expect(appended[0].src).toBe('https://www.youtube.com/iframe_api');

    const fakeYT = { Player: jasmine.createSpy('Player') };
    window.YT = fakeYT as unknown as Window['YT'];
    window.onYouTubeIframeAPIReady?.();

    expect(await first).toBe(fakeYT as unknown as NonNullable<Window['YT']>);
    expect(await second).toBe(fakeYT as unknown as NonNullable<Window['YT']>);
  });

  it('legt den Player über youtube-nocookie.com an', async () => {
    let received: YtPlayerOptions | undefined;
    class FakePlayer {
      constructor(_el: HTMLElement, options: YtPlayerOptions) {
        received = options;
      }
      loadVideoById() {
        return undefined;
      }
      destroy() {
        return undefined;
      }
    }
    window.YT = { Player: FakePlayer };

    await service.createPlayer(document.createElement('div'), {
      playerVars: { rel: 0 },
    });

    expect(received?.host).toBe('https://www.youtube-nocookie.com');
    expect(received?.playerVars).toEqual({ rel: 0 });
  });
});
