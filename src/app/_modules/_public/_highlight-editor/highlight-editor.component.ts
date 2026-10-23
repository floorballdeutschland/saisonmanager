import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, Subject, takeUntil } from 'rxjs';

import {
  HighlightEditorService,
  YoutubeIframeApiService,
  YtPlayer,
} from '@floorball/core';
import {
  HighlightEditorData,
  HighlightEditorScene,
  HighlightEditorUpdate,
} from '@floorball/types';

import {
  OFFSET_MAX,
  OFFSET_MIN,
  buildUpdate,
  calibrationStart,
  clampOffset,
  formatVideoTime,
  hasChanges,
  measureOffset,
  sceneWindow,
} from './highlight-editor.logic';

/** So lange darf es vom Klick bis zum spielbereiten Player dauern. */
export const EDITOR_PLAYER_TIMEOUT_MS = 15000;

/**
 * Ablage des Tokens für ein Neuladen im selben Tab, nachdem er aus der
 * Adresse genommen wurde. sessionStorage endet mit dem Tab.
 */
export const EDITOR_TOKEN_STORAGE_KEY = 'highlight_editor_token';

export type EditorState =
  | 'loading'
  | 'ready'
  | 'invalid'
  | 'expired'
  | 'forbidden'
  | 'failed';

/**
 * Kalibrierung und Highlight-Auswahl eines Tablet-Spiels (api#838).
 *
 * Erreichbar über den Mail-Link (`/highlights/bearbeiten?token=…`, ohne
 * Konto) und für Admin bzw. SBK des Spielbetriebs von der Spielseite aus
 * (`?spiel=<id>`, mit Sitzung). Beide Wege liefern dieselben Daten.
 *
 * KALIBRIERUNG: Das Video der Kalibrierszene läuft ab kurz vor dem
 * Antippen des ersten Tablet-Tors. Wer im Moment des Tors auf „Jetzt fällt
 * das Tor“ drückt, legt den Versatz fest: Abspielposition minus Sekunde des
 * Antippens. Feinkorrektur mit ±1 s und ±5 s, Prüfen mit der 20-s-Szene.
 *
 * AUSWAHL: Jede Szene (Tor mit Tablet-Schuss, vorgemerkte Szene) hat einen
 * Haken „in den Highlights“. Abspielen nutzt immer den eingestellten, auch
 * den noch nicht gespeicherten Versatz.
 *
 * Datenschutz wie im Szenen-Player der Spielseite: Bis zum Klick auf „Video
 * laden“ geht keine Anfrage an YouTube.
 *
 * DER TOKEN VERLÄSST DIE ADRESSLEISTE SOFORT. Prod liefert
 * `Referrer-Policy: no-referrer-when-downgrade` aus; stünde er beim Laden des
 * Players noch in der Adresse, ginge der Link samt Schreibrecht als Referer an
 * YouTube. Er wird deshalb beim Öffnen übernommen, für ein Neuladen im
 * sessionStorage abgelegt und per `replaceUrl` aus der Adresse entfernt.
 */
@Component({
  templateUrl: './highlight-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HighlightEditorComponent implements OnInit, OnDestroy {
  @ViewChild('playerHost') playerHost?: ElementRef<HTMLElement>;

  public state: EditorState = 'loading';
  public data: HighlightEditorData | null = null;
  /** Eingestellter Versatz, `null` = nicht kalibriert. */
  public offset: number | null = null;
  /** client_uuid → in den Highlights. */
  public selection: Record<string, boolean> = {};

  public consented = false;
  public playerLoading = false;
  public playerFailed = false;
  /** Was gerade läuft: die Kalibrierszene oder eine Szene der Liste. */
  public playing: 'calibration' | string | null = null;

  public saving = false;
  public saved = false;
  public saveFailed = false;
  /** Begründung der API bei einem abgewiesenen Speichern (422). */
  public saveError: string | null = null;

  public readonly offsetMin = OFFSET_MIN;
  public readonly offsetMax = OFFSET_MAX;
  public readonly formatVideoTime = formatVideoTime;

  private _token: string | null = null;
  private _gameId: number | null = null;
  private _player?: YtPlayer;
  private _playerReady = false;
  private _pendingPlay: (() => void) | null = null;
  private _readyTimer?: ReturnType<typeof setTimeout>;
  private _destroyed = false;
  private _destroy$ = new Subject<void>();

  constructor(
    private _service: HighlightEditorService,
    private _youtube: YoutubeIframeApiService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _transloco: TranslocoService,
    private _zone: NgZone,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const params = this._route.snapshot.queryParamMap;
    const gameId = parseInt(params.get('spiel') ?? '', 10);
    this._gameId = isNaN(gameId) ? null : gameId;
    const urlToken = params.get('token');
    if (urlToken) {
      this._token = urlToken;
      storeToken(urlToken);
      void this._router.navigate([], {
        relativeTo: this._route,
        queryParams: { token: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } else if (this._gameId === null) {
      // Neuladen nach dem Entfernen aus der Adresse.
      this._token = readToken();
    }

    if (!this._token && this._gameId === null) {
      this.state = 'invalid';
      return;
    }
    this._request(
      this._token
        ? this._service.getByToken(this._token)
        : this._service.getForGame(this._gameId as number)
    );
  }

  ngOnDestroy(): void {
    this._destroyed = true;
    this._destroy$.next();
    this._destroy$.complete();
    clearTimeout(this._readyTimer);
    this._player?.destroy();
  }

  get viaLink(): boolean {
    return this._token !== null;
  }

  get scenes(): HighlightEditorScene[] {
    return this.data?.scenes ?? [];
  }

  get calibrationAnchor(): number | null {
    return this.data?.calibration_scene?.anchor_second ?? null;
  }

  get calibrationLabel(): string {
    const uuid = this.data?.calibration_scene?.client_uuid;
    return this.scenes.find((scene) => scene.client_uuid === uuid)?.label ?? '';
  }

  get dirty(): boolean {
    return !!this.data && hasChanges(this._update());
  }

  /** Rückfrage beim Verlassen per Navigation (CanDeactivate). */
  public confirmLeave(): boolean {
    if (!this.dirty) return true;
    return window.confirm(
      this._transloco.translate('highlightEditor.leaveConfirm')
    );
  }

  /** Rückfrage beim Schließen oder Neuladen des Tabs. */
  @HostListener('window:beforeunload', ['$event'])
  public onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.dirty) return;
    event.preventDefault();
    // Ältere Browser zeigen die Rückfrage nur mit gesetztem returnValue.
    event.returnValue = '';
  }

  get selectedCount(): number {
    return this.scenes.filter((scene) => this.selection[scene.client_uuid])
      .length;
  }

  // --- Video -------------------------------------------------------------------

  /** Zustimmung: erst jetzt werden Skript und Video von YouTube geladen. */
  public async consent(): Promise<void> {
    const host = this.playerHost?.nativeElement;
    if (this._destroyed || this.consented || !this.data?.video_id || !host)
      return;

    this.consented = true;
    this.playerLoading = true;
    this.playerFailed = false;
    this._cdr.markForCheck();

    this._readyTimer = setTimeout(
      () =>
        this._zone.run(() => {
          if (!this._playerReady) this._failPlayer();
        }),
      EDITOR_PLAYER_TIMEOUT_MS
    );

    // Die API ersetzt das Element durch ihr iframe; ein eigenes Kind, damit
    // der Host im DOM bleibt.
    const target = document.createElement('div');
    host.appendChild(target);
    try {
      const player = await this._youtube.createPlayer(target, {
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (event) =>
            this._zone.run(() => {
              if (this._destroyed) return;
              clearTimeout(this._readyTimer);
              this._player ??= event.target;
              this._playerReady = true;
              this.playerLoading = false;
              const pending = this._pendingPlay;
              this._pendingPlay = null;
              pending?.();
              this._cdr.markForCheck();
            }),
          onError: () => this._zone.run(() => this._failPlayer()),
        },
      });
      // Die Seite wurde verlassen, während das Skript noch lud: Der Player
      // gehört zu keiner Ansicht mehr.
      if (this._destroyed) {
        player.destroy();
        return;
      }
      this._player = player;
    } catch {
      if (!this._destroyed) this._zone.run(() => this._failPlayer());
    }
  }

  private _failPlayer(): void {
    clearTimeout(this._readyTimer);
    this._player?.destroy();
    this._player = undefined;
    this._playerReady = false;
    this.playerHost?.nativeElement.replaceChildren();
    this.consented = false;
    this.playerLoading = false;
    this.playerFailed = true;
    this._cdr.markForCheck();
  }

  /** Abspielen, nach Bedarf erst nach der Zustimmung. */
  private _play(start: number, end: number | null, what: string): void {
    const videoId = this.data?.video_id;
    if (!videoId) return;
    this.playing = what;
    const run = () =>
      this._player?.loadVideoById({
        videoId,
        startSeconds: start,
        ...(end === null ? {} : { endSeconds: end }),
      });
    if (this._player && this._playerReady) {
      run();
    } else {
      this._pendingPlay = run;
      void this.consent();
    }
    this._cdr.markForCheck();
  }

  // --- Kalibrierung ------------------------------------------------------------

  /** Kalibrierszene von kurz vor dem Tor an, ohne Ende. */
  public playCalibration(): void {
    const anchor = this.calibrationAnchor;
    if (anchor === null) return;
    this._play(calibrationStart(anchor, this.offset), null, 'calibration');
  }

  /** „Jetzt fällt das Tor“: Versatz aus der Abspielposition. */
  public markGoalNow(): void {
    const anchor = this.calibrationAnchor;
    if (anchor === null || !this._player || !this._playerReady) return;
    this.offset = measureOffset(this._player.getCurrentTime(), anchor);
    this._player.pauseVideo();
    this.saved = false;
    this._cdr.markForCheck();
  }

  public adjustOffset(delta: number): void {
    this.offset = clampOffset((this.offset ?? 0) + delta);
    this.saved = false;
  }

  public resetOffset(): void {
    this.offset = null;
    this.saved = false;
  }

  /** Die Kalibrierszene als 20-s-Szene mit dem eingestellten Versatz. */
  public checkCalibration(): void {
    const scene = this.scenes.find(
      (entry) => entry.client_uuid === this.data?.calibration_scene?.client_uuid
    );
    if (scene) this.playScene(scene);
  }

  // --- Szenen ------------------------------------------------------------------

  public window(scene: HighlightEditorScene): { start: number; end: number } {
    return sceneWindow(scene, this.offset);
  }

  public playScene(scene: HighlightEditorScene): void {
    const { start, end } = this.window(scene);
    this._play(start, end, scene.client_uuid);
  }

  public toggleScene(scene: HighlightEditorScene): void {
    this.selection = {
      ...this.selection,
      [scene.client_uuid]: !this.selection[scene.client_uuid],
    };
    this.saved = false;
  }

  public setAll(value: boolean): void {
    this.selection = Object.fromEntries(
      this.scenes.map((scene) => [scene.client_uuid, value])
    );
    this.saved = false;
  }

  // --- Speichern ---------------------------------------------------------------

  public save(): void {
    if (!this.data || this.saving) return;
    const update = this._update();
    if (!hasChanges(update)) return;
    this.saving = true;
    this.saveFailed = false;
    this.saveError = null;
    this._sentOffset = this.offset;
    this._sentSelection = this.selection;
    this._request(
      this._token
        ? this._service.updateByToken(this._token, update)
        : this._service.updateForGame(this._gameId as number, update),
      true
    );
  }

  /** Stand beim Absenden, um Änderungen während des Speicherns zu erkennen. */
  private _sentOffset: number | null = null;
  private _sentSelection: Record<string, boolean> = {};

  private _update(): HighlightEditorUpdate {
    return this.data ? buildUpdate(this.data, this.offset, this.selection) : {};
  }

  private _request(
    request: Observable<HighlightEditorData>,
    saving = false
  ): void {
    request.pipe(takeUntil(this._destroy$)).subscribe({
      next: (data) => {
        if (saving) {
          this._applyKeepingLocal(data);
          this.saving = false;
          this.saved = !this.dirty;
        } else {
          this._apply(data);
        }
        this._cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        if (saving) {
          this.saving = false;
          // Ein abgelaufener Link oder entzogene Rechte gelten für die ganze
          // Seite, alles andere nur für diesen Versuch.
          const state = stateForError(err);
          if (state === 'failed') {
            this.saveFailed = true;
            const message = err.error?.message;
            this.saveError = typeof message === 'string' ? message : null;
          } else {
            this.state = state;
          }
        } else {
          this.state = stateForError(err);
        }
        if (this.state === 'invalid' || this.state === 'expired') {
          removeToken();
        }
        this._cdr.markForCheck();
      },
    });
  }

  private _apply(data: HighlightEditorData): void {
    this.data = data;
    this.offset = data.offset_seconds;
    this.selection = Object.fromEntries(
      data.scenes.map((scene) => [scene.client_uuid, scene.in_highlights])
    );
    this.state = 'ready';
  }

  /**
   * Antwort auf ein Speichern übernehmen, ohne Eingaben zu verwerfen, die
   * während des Speicherns gemacht wurden: Was sich seit dem Absenden
   * geändert hat, bleibt lokal stehen und ist danach wieder ungespeichert.
   */
  private _applyKeepingLocal(data: HighlightEditorData): void {
    const offset = this.offset;
    const selection = this.selection;
    const sentOffset = this._sentOffset;
    const sentSelection = this._sentSelection;
    this._apply(data);
    if (offset !== sentOffset) this.offset = offset;
    for (const uuid of Object.keys(selection)) {
      if (selection[uuid] !== sentSelection[uuid] && uuid in this.selection) {
        this.selection = { ...this.selection, [uuid]: selection[uuid] };
      }
    }
  }
}

function storeToken(token: string): void {
  try {
    sessionStorage.setItem(EDITOR_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ohne Speicher funktioniert die Seite, nur ein Neuladen nicht.
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(EDITOR_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function removeToken(): void {
  try {
    sessionStorage.removeItem(EDITOR_TOKEN_STORAGE_KEY);
  } catch {
    // nichts zu tun
  }
}

export function stateForError(err: { status?: number }): EditorState {
  switch (err?.status) {
    case 404:
      return 'invalid';
    case 410:
      return 'expired';
    case 401:
    case 403:
      return 'forbidden';
    default:
      return 'failed';
  }
}
