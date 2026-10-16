import { Injectable } from '@angular/core';

/**
 * Nur der Ausschnitt der YouTube IFrame Player API, den der Szenen-Player
 * braucht. Kein Typpaket für die ganze Bibliothek.
 */
export interface YtPlayer {
  loadVideoById(options: {
    videoId: string;
    startSeconds?: number;
    endSeconds?: number;
  }): void;
  destroy(): void;
}

export interface YtPlayerEvent {
  data: number;
  target: YtPlayer;
}

export interface YtPlayerOptions {
  host?: string;
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YtPlayerEvent) => void;
    onStateChange?: (event: YtPlayerEvent) => void;
    onError?: (event: YtPlayerEvent) => void;
  };
}

interface YtNamespace {
  Player: new (element: HTMLElement, options: YtPlayerOptions) => YtPlayer;
}

/** `onStateChange`: das Video oder der mit endSeconds begrenzte Ausschnitt ist zu Ende. */
export const YT_STATE_ENDED = 0;

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';

/**
 * Lädt die YouTube IFrame Player API erst auf Anforderung. Der Szenen-Player
 * ruft das erst nach dem Klick auf „Szenen laden“ auf (Zwei-Klick-Lösung): Vor
 * dieser Zustimmung geht keine Anfrage an YouTube. Die Videos selbst laufen
 * über youtube-nocookie.com.
 */
@Injectable({ providedIn: 'root' })
export class YoutubeIframeApiService {
  private _ready?: Promise<YtNamespace>;

  load(): Promise<YtNamespace> {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (this._ready) return this._ready;

    this._ready = new Promise<YtNamespace>((resolve, reject) => {
      // Eine andere Stelle könnte den Rückruf schon gesetzt haben; die API
      // ruft nur diesen einen auf.
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (window.YT) resolve(window.YT);
      };

      const script = document.createElement('script');
      script.src = IFRAME_API_URL;
      script.async = true;
      script.onerror = () => {
        // Ein späterer Klick darf es noch einmal versuchen.
        this._ready = undefined;
        script.remove();
        reject(new Error('YouTube IFrame API nicht ladbar'));
      };
      document.head.appendChild(script);
    });
    return this._ready;
  }

  /** Legt einen Player an der Stelle von `element` an (ersetzt es durch ein iframe). */
  async createPlayer(
    element: HTMLElement,
    options: YtPlayerOptions
  ): Promise<YtPlayer> {
    const yt = await this.load();
    return new yt.Player(element, {
      host: 'https://www.youtube-nocookie.com',
      ...options,
    });
  }
}
