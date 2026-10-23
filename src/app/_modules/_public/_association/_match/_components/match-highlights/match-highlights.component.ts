import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  YoutubeIframeApiService,
  YT_STATE_ENDED,
  YtPlayer,
} from '@floorball/core';
import { HighlightScene, Highlights } from '@floorball/types';
import { nextSceneIndex, personLabel } from '../../_utils/highlights';

/**
 * Szenen-Player für die Tore eines Tablet-Spiels (fe#555). Spielt die Szenen
 * der Stream-Aufzeichnung nacheinander über `start`/`end` ab, ohne ein Video zu
 * schneiden.
 *
 * Datenschutz: Zwei-Klick-Lösung. Bis zum Klick auf „Szenen laden“ geht keine
 * Anfrage an YouTube, weder für das Skript der Player API noch für das Video.
 * Die Videos laufen über youtube-nocookie.com.
 *
 * Ob es etwas abzuspielen gibt, entscheidet die Elternkomponente
 * (`hasPlayableHighlights`); ohne Daten wird dieser Player gar nicht erst
 * gerendert. Meldet YouTube einen Fehler (Video privat, gelöscht, Einbetten
 * verboten), gibt der Player `unavailable` aus und die Szenen verschwinden
 * still.
 */
/** So lange darf es vom Klick bis zum spielbereiten Player dauern. */
export const PLAYER_READY_TIMEOUT_MS = 15000;

@Component({
  selector: 'fb-match-highlights',
  templateUrl: './match-highlights.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MatchHighlightsComponent implements OnChanges, OnDestroy {
  @Input() highlights!: Highlights;
  @Input() homeName = '';
  @Input() guestName = '';

  @Output() unavailable = new EventEmitter<void>();

  @ViewChild('playerHost') playerHost?: ElementRef<HTMLElement>;

  consented = false;
  loading = false;
  loadFailed = false;
  /** Die laufende Szene, `null` vor dem Start. */
  currentIndex: number | null = null;
  /** Mit dieser Szene beginnt die Wiedergabe nach der Zustimmung. */
  pendingIndex = 0;
  finished = false;

  private _player?: YtPlayer;
  private _playerReady = false;
  private _generation = 0;
  private _readyTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private _youtube: YoutubeIframeApiService,
    private _zone: NgZone,
    private _cdr: ChangeDetectorRef,
    private _host: ElementRef<HTMLElement>
  ) {}

  get scenes(): HighlightScene[] {
    return this.highlights?.scenes ?? [];
  }

  get currentScene(): HighlightScene | null {
    return this.currentIndex !== null
      ? (this.scenes[this.currentIndex] ?? null)
      : null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['highlights'];
    if (!change || change.firstChange) return;

    const previous = change.previousValue as Highlights | undefined;
    if (previous?.video_id !== this.highlights?.video_id) {
      // Anderes Video (Spielwechsel): Der alte Player gehört nicht mehr
      // hierher, die Zustimmung gilt für den nächsten Klick neu.
      this.reset();
    } else if (
      this.currentIndex !== null &&
      this.currentIndex >= this.scenes.length
    ) {
      this.currentIndex = null;
    }
  }

  ngOnDestroy(): void {
    this.destroyPlayer();
  }

  /** Zustimmung: erst jetzt werden Skript und Video von YouTube geladen. */
  async consent(): Promise<void> {
    if (this.consented || !this.highlights?.video_id) return;
    const host = this.playerHost?.nativeElement;
    if (!host) return;

    this.consented = true;
    this.loading = true;
    this.loadFailed = false;
    this._cdr.markForCheck();

    // Jeder Ladeversuch bekommt eine Nummer. Spielwechsel, Abbau oder ein
    // Fehlschlag erhöhen sie; was danach von einem älteren Versuch ankommt,
    // ist verwaist und wird verworfen.
    const generation = ++this._generation;
    const stale = () => generation !== this._generation;

    // Meldet sich der Player nicht (Skript halb geblockt, Netz weg), bleibt
    // sonst „Video wird geladen“ für immer stehen.
    this._readyTimer = setTimeout(
      () =>
        this._zone.run(() => {
          if (!stale() && !this._playerReady) this.failLoading();
        }),
      PLAYER_READY_TIMEOUT_MS
    );

    // Die API ersetzt das übergebene Element durch ihr iframe. Ein eigenes
    // Kind statt des Angular-Elements, damit der Host im DOM bleibt.
    const target = document.createElement('div');
    host.appendChild(target);

    let player: YtPlayer;
    try {
      player = await this._youtube.createPlayer(target, {
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (event) =>
            this._zone.run(() => {
              if (stale()) return;
              clearTimeout(this._readyTimer);
              this._player ??= event.target;
              this._playerReady = true;
              this.loading = false;
              this.playScene(this.pendingIndex);
            }),
          onStateChange: (event) =>
            this._zone.run(() => {
              if (stale()) return;
              if (event.data === YT_STATE_ENDED) this.onSceneEnded();
            }),
          onError: () =>
            this._zone.run(() => {
              if (stale()) return;
              this.destroyPlayer();
              this.unavailable.emit();
            }),
        },
      });
    } catch {
      this._zone.run(() => {
        if (!stale()) this.failLoading();
      });
      return;
    }

    if (stale()) {
      // Während des Ladens kam ein anderes Spiel oder die Seite wurde
      // verlassen: Der Player hängt an einem abgehängten Element.
      player.destroy();
      return;
    }
    this._player = player;
  }

  /** Laden gescheitert: Hinweis und Knopf wieder zeigen, neuer Versuch möglich. */
  private failLoading(): void {
    this.destroyPlayer();
    this.consented = false;
    this.loading = false;
    this.loadFailed = true;
    this._cdr.markForCheck();
  }

  /** Klick auf eine Szene in der Liste oder ein Tor in der Schussgrafik. */
  selectScene(index: number): void {
    if (index < 0 || index >= this.scenes.length) return;
    if (this._player && this._playerReady) {
      this.playScene(index);
    } else {
      this.pendingIndex = index;
      this._cdr.markForCheck();
    }
  }

  /**
   * Sprung von außen (Schussgrafik): Szene wählen und den Player ins Bild
   * holen. Vor der Zustimmung wird nichts geladen, die Szene startet dann mit
   * dem Klick auf „Szenen laden“.
   */
  jumpTo(index: number): void {
    this.selectScene(index);
    this._host.nativeElement.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    });
  }

  playAll(): void {
    this.selectScene(0);
  }

  playScene(index: number): void {
    const scene = this.scenes[index];
    if (!scene || !this._player || !this.highlights?.video_id) return;
    this.currentIndex = index;
    this.finished = false;
    this._player.loadVideoById({
      videoId: this.highlights.video_id,
      startSeconds: scene.start,
      endSeconds: scene.end,
    });
    this._cdr.markForCheck();
  }

  /** Eine Szene ist zu Ende: die nächste, nach der letzten ist Schluss. */
  onSceneEnded(): void {
    if (this.currentIndex === null) return;
    const next = nextSceneIndex(this.currentIndex, this.scenes.length);
    if (next === null) {
      this.finished = true;
      this._cdr.markForCheck();
    } else {
      this.playScene(next);
    }
  }

  personLabel = personLabel;

  /** Am Tablet vorgemerkte Szene ohne Tor (api#838). */
  isMark(scene: HighlightScene): boolean {
    return scene.kind === 'mark';
  }

  private reset(): void {
    this.destroyPlayer();
    this.consented = false;
    this.loading = false;
    this.loadFailed = false;
    this.currentIndex = null;
    this.pendingIndex = 0;
    this.finished = false;
    this._cdr.markForCheck();
  }

  private destroyPlayer(): void {
    this._generation++;
    clearTimeout(this._readyTimer);
    this._player?.destroy();
    this._player = undefined;
    this._playerReady = false;
    const host = this.playerHost?.nativeElement;
    if (host) host.replaceChildren();
  }
}
