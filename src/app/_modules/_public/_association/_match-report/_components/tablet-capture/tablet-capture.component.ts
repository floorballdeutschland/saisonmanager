import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { Subscription, lastValueFrom, timeout } from 'rxjs';

import {
  GameShotService,
  NotificationService,
  StorageService,
} from '@floorball/core';
import {
  Game,
  GameEvent,
  GamePlayerEntry,
  NotificationType,
  Shot,
  ShotInput,
  ShotKind,
  ShotResult,
  ShotTeam,
  UserNotification,
} from '@floorball/types';
import {
  FieldGeometry,
  FieldMarkings,
  fieldGeometry,
  fieldMarkings,
} from 'src/app/_helpers/_utils/field-geometry';

import { ShotBuffer } from './shot-buffer';
import { TabletShotSyncService } from './tablet-shot-sync.service';
import {
  ClockSample,
  GoalLinkCandidate,
  PulledGoalies,
  SideConfig,
  attacksRight,
  bestClockOffset,
  consistentShotFlags,
  defaultGoalkeeperId,
  followsFreeHit,
  fromAttackDirection,
  goalLinkCandidates,
  goaliePulled,
  isFreeHit,
  isMark,
  isPlaced,
  isUnplacedSave,
  leftToRightTeam,
  mergeShots,
  newClientUuid,
  normalizeGameTime,
  otherTeam,
  playablePeriods,
  shootingTeamForTap,
  situationFor,
  toAttackDirection,
  toServerTime,
} from './tablet-capture.logic';

export interface ShotDraft {
  client_uuid: string;
  // Ein Freischlag entsteht ohne Entwurf (ein Tipp); als Entwurf nur beim
  // Korrigieren.
  kind: ShotKind;
  // Gerätezeit des Antippens (ms). Umgerechnet in Serverzeit wird erst beim
  // Speichern: Ein Tipp, der vor dem Ende der Uhrmessung fiel, bekommt so
  // noch den gemessenen Versatz. Null bei einem geladenen Schuss, dessen
  // `tapped_at` schon feststeht.
  tapped_device_ms: number | null;
  tapped_at: string;
  // Angetippte Stelle auf dem Bildschirm (0..1). Normiert wird erst beim
  // Speichern, weil sich Team und Abschnitt bis dahin noch ändern dürfen.
  screenX: number;
  screenY: number;
  team: ShotTeam;
  period: number;
  game_time: string;
  result: ShotResult | null;
  shooter_player_id: number | null;
  goalkeeper_player_id: number | null;
  from_free_hit: boolean;
  // Schalter „aus Freischlag“ von Hand gesetzt: dann nicht mehr vorbelegen.
  fromFreeHitTouched: boolean;
  // Strafschuss und Torwartsituation (Feedback #61, #63, #64). Die
  // Torwartsituation kommt aus den Schaltern „Torwart raus“ und lässt sich je
  // Schuss umstellen.
  from_penalty_shot: boolean;
  empty_net: boolean;
  extra_attacker: boolean;
  isEdit: boolean;
}

/** Zuletzt per Tipp gespeicherter Freischlag, für Teamtausch und Rückgängig. */
export interface LastFreeHit {
  client_uuid: string;
  team: ShotTeam;
  period: number;
  screenX: number;
  screenY: number;
}

/**
 * Angetippte Stelle, bevor feststeht, was dort war (Schuss oder Freischlag).
 * Zeitpunkt und Stelle stehen fest, sobald der Finger das Feld berührt; die
 * Wahl danach ändert daran nichts.
 */
export interface PendingTap {
  // Gerätezeit des ersten Antippens (ms), umgerechnet wird erst beim Speichern.
  tapped_device_ms: number;
  screenX: number;
  screenY: number;
  // Vorschlag für den Schuss, aus der Feldhälfte wie bisher.
  team: ShotTeam;
  period: number;
}

export type DisplayedShot = ReturnType<typeof mergeShots>[number];

const CLOCK_OFFSET_KEY = 'tablet_clock_offset';
const SIDES_KEY_PREFIX = 'tablet_sides_';
const PULLED_KEY_PREFIX = 'tablet_pulled_goalie_';
const RETRY_INTERVAL_MS = 15000;
const CLOCK_SAMPLES = 3;
const CLOCK_TIMEOUT_MS = 5000;
// Ein Tipp gilt als Tipp, solange der Finger sich kaum bewegt; darüber ist es
// ein Wischen (Scrollen am Tablet) und erzeugt keinen Schuss.
const TAP_MAX_MOVE_PX = 12;
// Ein offener Entwurf oder eine offene Wahl, die älter ist, wird von einem
// neuen Tipp nicht mehr verschoben, sondern ersetzt: Dann ist es eine neue
// Szene mit neuem Zeitpunkt.
const DRAFT_MOVE_WINDOW_MS = 10000;
const RECENT_SHOTS = 8;

/**
 * Erfassungsansicht des Tabletmodus (Beta, fe#344): Erst das Spielfeld
 * antippen, dann wählen, was es war: Schuss (danach Ergebnis und auf Wunsch
 * Schütze und Torhüter als große Kacheln) oder Freischlag (sofort
 * gespeichert). Auf Wunsch als Vollbild über der ganzen Seite.
 *
 * Die Spielseite wird über Spiele wiederverwendet (CLAUDE.md): Die Spiel-ID
 * kommt deshalb ausschließlich aus `game`, und jeder Zustand, der an einem
 * Spiel hängt (Entwurf, Puffer, Seitenwahl, Serverstand), wird beim Wechsel
 * der ID neu aufgesetzt. Antworten, die für ein vorheriges Spiel unterwegs
 * waren, werden verworfen.
 *
 * Der Abschnitt der Erfassung folgt dem Spielstand vom Server
 * (`current_period_title`), nicht dem `currentPeriod` des Spielberichts: Den
 * verstellt dort auch die Abschnittsauswahl eines Tor- oder Strafformulars,
 * und die Verknüpfung Tor ↔ Schuss in der API verlangt den Abschnitt, in dem
 * das Spiel tatsächlich steht. Schaltet ein anderes Gerät weiter, kommt das
 * mit dem nächsten Nachladen der Spielseite (30-Sekunden-Takt) hier an.
 */
@Component({
  selector: 'fb-tablet-capture',
  templateUrl: './tablet-capture.component.html',
  styleUrl: './tablet-capture.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TabletCaptureComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  game!: Game;

  /**
   * `league.field_size` ('GF' / 'KF'). Bestimmt nur die Zeichnung: Die
   * Positionen bleiben auf 0..1 von Bande zu Bande normiert (fe#591).
   */
  @Input()
  fieldSize: string | null | undefined = null;

  public field: FieldGeometry = fieldGeometry(null);
  public markings: FieldMarkings = fieldMarkings(this.field);

  public readonly results: ShotResult[] = [
    'goal',
    'saved',
    'missed',
    'blocked',
  ];

  public buffer: ShotBuffer | null = null;
  public serverShots: Shot[] = [];
  public sides: SideConfig = {};
  public viewPeriod = 1;
  // Spielbarer Abschnitt, in dem das Spiel laut Server gerade steht (in der
  // Pause schon der nächste). `viewPeriod` folgt ihm bei jeder Änderung; eine
  // Abweichung entsteht nur durch bewusstes Umstellen (Nachträge).
  public gamePeriod = 1;
  // Der Abschnitt des Spiels hat sich geändert, während ein Entwurf offen war.
  // Nachgeführt wird nach dem Speichern oder Verwerfen, damit der Schuss im
  // Abschnitt bleibt, in dem er angetippt wurde.
  public periodChangePending = false;
  public draft: ShotDraft | null = null;
  public gameTimeInvalid = false;

  // Angetippte Stelle, für die noch gewählt wird, was sie war. Freischläge
  // wählen ihr Team ausdrücklich, weil ein Freischlag oft in der eigenen
  // Hälfte ausgeführt wird und die Feldhälfte dann das falsche Team ergäbe.
  public pendingTap: PendingTap | null = null;
  public lastFreeHit: LastFreeHit | null = null;

  // Zuletzt vorgemerkte Szene (api#838), für den Hinweis mit „Rückgängig“.
  public lastMark: string | null = null;

  // „Torwart raus“ je Team (Feedback #63, #64), gemerkt je Gerät und Spiel.
  public pulledGoalies: PulledGoalies = {};

  public clockOffset: number | null = null;
  public clockStatus: 'measuring' | 'ok' | 'stale' | 'unknown' = 'measuring';

  // Meldung, wenn eine Zuordnung abgewiesen wurde (403/404 meldet der
  // Interceptor für diese Endpunkte nicht selbst).
  public linkError = false;

  // Vollbild: fixierte Ebene über der ganzen Seite, zusätzlich die
  // Fullscreen-API des Browsers, wo es sie gibt.
  public fullscreen = false;
  // Der Browser zeigt die Erfassung gerade per Fullscreen-API.
  private _nativeFullscreen = false;
  private _bodyOverflowBefore: string | null = null;
  private readonly _document = inject(DOCUMENT);
  private readonly _notifications = inject(NotificationService);
  private _noticeSubscription: Subscription | null = null;

  // Meldungen der Seite, gespiegelt für die Dauer des Browser-Vollbilds.
  public fullscreenNotices: UserNotification[] = [];
  public readonly noticeTypes = NotificationType;

  @ViewChild('captureRoot', { static: true })
  private _root?: ElementRef<HTMLElement>;

  private _pointerDown: {
    pointerId: number;
    clientX: number;
    clientY: number;
    deviceNow: number;
  } | null = null;

  // Zuletzt bewusst gewählter Torhüter je Team. Gilt für die folgenden Schüsse
  // weiter, bis wieder umgestellt wird (Torhüterwechsel im Spiel).
  private _goalkeeperChoice: Partial<Record<ShotTeam, number | null>> = {};

  private _gameId: number | null = null;
  // Angezeigter Abschnitt vor dem Korrigieren eines älteren Schusses; danach
  // geht es dorthin zurück.
  private _periodBeforeEdit: number | null = null;
  private _goalSignature = '';
  private _retryTimer: ReturnType<typeof setInterval> | null = null;
  private _shotsSubscription: Subscription | null = null;
  private readonly _onOnline = () => this._autoFlush();

  constructor(
    private _shotService: GameShotService,
    private _sync: TabletShotSyncService,
    private _storage: StorageService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Vorläufig der zuletzt gemessene Versatz dieses Geräts, damit auch ein
    // Tipp vor dem Ende der Messung korrigiert ist.
    const stored = parseInt(this._storage.getItem(CLOCK_OFFSET_KEY), 10);
    if (!isNaN(stored)) this.clockOffset = stored;
    void this.measureClock();

    this._noticeSubscription = this._notifications
      .onNotification()
      .subscribe((notice) => this._mirrorNotice(notice));
    this._shotsSubscription = this._sync.shots$.subscribe(
      ({ gameId, shots }) => {
        this._applyServerShots(gameId, shots);
        this._cdr.markForCheck();
      }
    );
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._onOnline);
      this._retryTimer = setInterval(() => {
        if ((this.buffer?.size ?? 0) > 0) this._autoFlush();
      }, RETRY_INTERVAL_MS);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fieldSize']) {
      this.field = fieldGeometry(this.fieldSize);
      this.markings = fieldMarkings(this.field);
    }
    if (changes['game'] && this.game) {
      if (this.game.id !== this._gameId) {
        this._resetForGame(this.game.id);
        return;
      }
      this._followGamePeriod();
      if (this._currentGoalSignature() !== this._goalSignature) {
        // Ein neu eingetragenes oder gelöschtes Tor kann die automatische
        // Verknüpfung in der API geändert haben.
        this._goalSignature = this._currentGoalSignature();
        this.loadShots();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.fullscreen) this.exitFullscreen();
    if (this._retryTimer) clearInterval(this._retryTimer);
    this._retryTimer = null;
    this._shotsSubscription?.unsubscribe();
    this._noticeSubscription?.unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._onOnline);
    }
  }

  // --- Spielwechsel ----------------------------------------------------------

  private _resetForGame(gameId: number): void {
    this._gameId = gameId;
    this.buffer = this._sync.buffer(gameId);
    this.serverShots = [];
    this.draft = null;
    this._pointerDown = null;
    this.gameTimeInvalid = false;
    this.pendingTap = null;
    this.lastFreeHit = null;
    this.lastMark = null;
    this.linkError = false;
    this._goalkeeperChoice = {};
    this.sides = this._loadSides(gameId);
    this.pulledGoalies = this._loadPulledGoalies(gameId);
    this.gamePeriod = this._periodFromGame();
    this.viewPeriod = this.gamePeriod;
    this.periodChangePending = false;
    this._periodBeforeEdit = null;
    this._goalSignature = this._currentGoalSignature();
    this.loadShots();
    this._autoFlush();
  }

  // In der Pause steht dort z. B. 1.5. Anders als `currentPeriod` im
  // Spielbericht wird AUFGERUNDET: Mit „Drittelpause beginnt“ ist der Abschnitt
  // vorbei, geschossen wird erst wieder im nächsten. So steht das Tablet beim
  // Anpfiff schon richtig, auch wenn ein zweites Gerät „nächstes Drittel
  // starten“ erst mit dem nächsten Nachladen (bis 30 s) liefert.
  private _periodFromGame(): number {
    const parsed = Math.ceil(this.game?.current_period_title?.period || 0);
    const periods = this.periods;
    if (isNaN(parsed) || parsed < 1) return periods[0] ?? 1;
    // Im Penalty-Schießen oder einer unbekannten Phase bleibt die Erfassung
    // beim letzten spielbaren Abschnitt.
    return Math.min(parsed, periods[periods.length - 1] ?? parsed);
  }

  /**
   * Hat sich der Abschnitt des Spiels geändert, springt die Erfassung mit,
   * auch wenn vorher von Hand ein anderer gewählt war. Bleibt er gleich, bleibt
   * auch eine Handauswahl stehen.
   */
  private _followGamePeriod(): void {
    const period = this._periodFromGame();
    if (period === this.gamePeriod) return;
    this.gamePeriod = period;
    if (this.draft || this.pendingTap) {
      this.periodChangePending = true;
    } else {
      this.viewPeriod = period;
    }
  }

  /**
   * Nach dem Schließen eines Entwurfs (Speichern, Verwerfen, Löschen) oder
   * einer Wahl ohne offenen Entwurf.
   */
  private _afterDraftClosed(): void {
    if (this.periodChangePending) {
      this.viewPeriod = this.gamePeriod;
    } else if (this._periodBeforeEdit !== null) {
      this.viewPeriod = this._periodBeforeEdit;
    }
    this.periodChangePending = false;
    this._periodBeforeEdit = null;
  }

  /** Zurück zum Abschnitt, in dem das Spiel steht. */
  public followGamePeriod(): void {
    this.selectViewPeriod(this.gamePeriod);
  }

  get followsGame(): boolean {
    return this.viewPeriod === this.gamePeriod;
  }

  // Team und Torart gehören dazu: Wird ein Tor nachträglich zum Eigentor oder
  // technischen Tor oder wechselt es das Team, löst die API seinen Schuss
  // (api#857). Ohne Nachladen hielte das Tablet die alte Verknüpfung fest.
  private _currentGoalSignature(): string {
    return (this.game?.events ?? [])
      .filter((event) => event.event_type === 'goal')
      .map(
        (event) =>
          `${event.event_id}:${event.event_team}:${event.goal_type ?? ''}`
      )
      .join(',');
  }

  // --- Serverzeit ------------------------------------------------------------

  /**
   * Misst die Abweichung der Geräteuhr zur Serverzeit. Mehrere Messungen
   * nacheinander, es gilt die mit dem kürzesten Round-Trip. Ohne Verbindung
   * bleibt der zuletzt gemessene Wert dieses Geräts.
   */
  public async measureClock(): Promise<void> {
    this.clockStatus = 'measuring';
    const samples: ClockSample[] = [];
    for (let i = 0; i < CLOCK_SAMPLES; i++) {
      const sentAt = Date.now();
      try {
        const response = await lastValueFrom(
          this._shotService
            .getServerTime()
            .pipe(timeout({ first: CLOCK_TIMEOUT_MS }))
        );
        samples.push({
          sentAt,
          receivedAt: Date.now(),
          serverNow: response.now,
        });
      } catch {
        break;
      }
    }

    const offset = bestClockOffset(samples);
    if (offset !== null) {
      this.clockOffset = offset;
      this.clockStatus = 'ok';
      this._storage.setItem(CLOCK_OFFSET_KEY, String(offset));
    } else {
      const stored = parseInt(this._storage.getItem(CLOCK_OFFSET_KEY), 10);
      this.clockOffset = isNaN(stored) ? null : stored;
      this.clockStatus = isNaN(stored) ? 'unknown' : 'stale';
    }
    this._cdr.markForCheck();
  }

  // --- Seitenwahl --------------------------------------------------------------

  get periods(): number[] {
    return playablePeriods(this.game?.period_titles);
  }

  get rightAttackingTeam(): ShotTeam {
    return leftToRightTeam(this.viewPeriod, this.sides);
  }

  get leftAttackingTeam(): ShotTeam {
    return otherTeam(this.rightAttackingTeam);
  }

  public swapSides(): void {
    if (this._gameId === null) return;
    this.sides = {
      ...this.sides,
      [String(this.viewPeriod)]: otherTeam(this.rightAttackingTeam),
    };
    // Der Vorschlag einer offenen Wahl folgt der neuen Spielrichtung.
    const tap = this.pendingTap;
    if (tap) tap.team = shootingTeamForTap(tap.screenX, tap.period, this.sides);
    this._storage.setItem(
      SIDES_KEY_PREFIX + this._gameId,
      JSON.stringify(this.sides)
    );
  }

  public selectViewPeriod(period: number): void {
    this.viewPeriod = period;
    if (this.draft) this.draft.period = period;
    if (this.pendingTap) this.pendingTap.period = period;
    this._cdr.markForCheck();
  }

  private _loadSides(gameId: number): SideConfig {
    try {
      const parsed = JSON.parse(
        this._storage.getItem(SIDES_KEY_PREFIX + gameId) || '{}'
      );
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  // --- Torwart raus (Feedback #63, #64) ---------------------------------------

  /**
   * Spielt das Team im angezeigten Abschnitt ohne Torhüter? Gesetzt wird der
   * Schalter nur im laufenden Abschnitt; in einem nachträglich angezeigten
   * Abschnitt ist er daher aus.
   */
  public isGoaliePulled(team: ShotTeam): boolean {
    return goaliePulled(this.pulledGoalies, team, this.viewPeriod);
  }

  /**
   * „Torwart raus“ ist eine Lage im laufenden Spiel und lässt sich nur im
   * Abschnitt schalten, in dem das Spiel steht. Bei Nachträgen in einem
   * anderen Abschnitt bleibt der Schalter gesperrt.
   */
  get canToggleGoaliePulled(): boolean {
    return this.followsGame;
  }

  /**
   * Schalter „Torwart raus“: gilt bis zum Zurücknehmen, längstens bis zum
   * Ende des laufenden Abschnitts. Ein offener Entwurf bleibt unberührt; er
   * wurde in der Lage davor angetippt.
   */
  public toggleGoaliePulled(team: ShotTeam): void {
    if (this._gameId === null || !this.canToggleGoaliePulled) return;
    const pulled = { ...this.pulledGoalies };
    if (goaliePulled(pulled, team, this.gamePeriod)) {
      delete pulled[team];
    } else {
      pulled[team] = this.gamePeriod;
    }
    this.pulledGoalies = pulled;
    this._storage.setItem(
      PULLED_KEY_PREFIX + this._gameId,
      JSON.stringify(pulled)
    );
  }

  private _loadPulledGoalies(gameId: number): PulledGoalies {
    try {
      const parsed = JSON.parse(
        this._storage.getItem(PULLED_KEY_PREFIX + gameId) || '{}'
      );
      const pulled: PulledGoalies = {};
      for (const team of ['home', 'guest'] as ShotTeam[]) {
        if (Number.isInteger(parsed?.[team])) pulled[team] = parsed[team];
      }
      return pulled;
    } catch {
      return {};
    }
  }

  // --- Erfassen ----------------------------------------------------------------

  /**
   * Der Zeitstempel entsteht hier, beim ersten Berühren des Spielfelds, und
   * bleibt beim Bearbeiten erhalten. Nur so taugt er als Torzeitpunkt für
   * Sprungmarken und Highlights: Das offizielle Tor wird erst beim Bully
   * eingetragen.
   */
  //
  // Festgehalten wird der Zeitpunkt bei `pointerdown`, angelegt wird der
  // Entwurf aber erst beim Loslassen und nur, wenn der Finger kaum gewandert
  // ist: Ein Wischen zum Scrollen, ein zweiter Finger oder ein Rechtsklick
  // sind kein Schuss.
  public onFieldPointerDown(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) return;
    this._pointerDown = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      deviceNow: Date.now(),
    };
  }

  public onFieldPointerUp(event: PointerEvent): void {
    const down = this._pointerDown;
    this._pointerDown = null;
    if (!down || down.pointerId !== event.pointerId) return;

    const moved = Math.hypot(
      event.clientX - down.clientX,
      event.clientY - down.clientY
    );
    if (moved > TAP_MAX_MOVE_PX) return;

    const target = event.currentTarget as Element | null;
    const rect = target?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const screenX = (down.clientX - rect.left) / rect.width;
    const screenY = (down.clientY - rect.top) / rect.height;
    this.tapField(screenX, screenY, down.deviceNow);
  }

  public onFieldPointerCancel(): void {
    this._pointerDown = null;
  }

  /**
   * Ein Tipp aufs Feld hält Stelle und Zeitpunkt fest; was es war, wird danach
   * gewählt (`chooseTapShot`, `chooseTapFreeHit`, `cancelTap`).
   *
   * Erneutes Tippen verschiebt nur die Stelle, solange es zur selben Szene
   * gehört: während der Wahl und bei einem offenen Entwurf jeweils innerhalb
   * des Verschiebe-Fensters, bei einer Korrektur immer. Der Zeitpunkt bleibt
   * dabei der des ersten Antippens.
   */
  public tapField(
    screenX: number,
    screenY: number,
    deviceNow = Date.now()
  ): void {
    const pending = this.pendingTap;
    if (pending) {
      if (deviceNow - pending.tapped_device_ms <= DRAFT_MOVE_WINDOW_MS) {
        pending.screenX = screenX;
        pending.screenY = screenY;
        pending.team = shootingTeamForTap(screenX, pending.period, this.sides);
        return;
      }
    } else if (this.draft && this._draftMovable(this.draft, deviceNow)) {
      this.draft.screenX = screenX;
      this.draft.screenY = screenY;
      return;
    }
    this.pendingTap = {
      tapped_device_ms: deviceNow,
      screenX,
      screenY,
      team: shootingTeamForTap(screenX, this.viewPeriod, this.sides),
      period: this.viewPeriod,
    };
  }

  /**
   * Die Stelle war ein Schuss. Ohne Team gilt der Vorschlag aus der
   * Feldhälfte. Ein älterer, nie gespeicherter Entwurf wird ersetzt, wie
   * bisher bei einem neuen Tipp nach dem Verschiebe-Fenster.
   */
  public chooseTapShot(team?: ShotTeam): void {
    const tap = this.pendingTap;
    if (!tap) return;
    this.pendingTap = null;
    this.draft = null;
    this.startDraft(
      tap.screenX,
      tap.screenY,
      tap.tapped_device_ms,
      team ?? tap.team
    );
  }

  /**
   * Die Stelle war ein Freischlag dieses Teams: sofort gespeichert, mit der
   * angetippten Stelle und dem Zeitpunkt des Antippens. Ein offener
   * Schuss-Entwurf bleibt unangetastet.
   */
  public chooseTapFreeHit(team: ShotTeam): void {
    const tap = this.pendingTap;
    if (!tap) return;
    this.pendingTap = null;
    this.recordFreeHit(team, tap.screenX, tap.screenY, tap.tapped_device_ms);
    if (!this.draft) this._afterDraftClosed();
  }

  /** Der Tipp war nichts: Stelle und Zeitpunkt verwerfen. */
  public cancelTap(): void {
    if (!this.pendingTap) return;
    this.pendingTap = null;
    if (!this.draft) this._afterDraftClosed();
  }

  private _draftMovable(draft: ShotDraft, deviceNow: number): boolean {
    return (
      draft.isEdit ||
      draft.tapped_device_ms === null ||
      deviceNow - draft.tapped_device_ms <= DRAFT_MOVE_WINDOW_MS
    );
  }

  public startDraft(
    screenX: number,
    screenY: number,
    deviceNow = Date.now(),
    shootingTeam?: ShotTeam
  ): void {
    // Ein frischer Entwurf wird nur verschoben: Wer die Stelle gleich
    // nachbessert, meint denselben Schuss, und dessen Zeitpunkt bleibt. Ein
    // geladener Schuss (Korrektur) wird immer verschoben. Ist ein neuer
    // Entwurf älter als das Zeitfenster, war es ein neuer Schuss: Der alte,
    // nie gespeicherte Entwurf wird verworfen.
    const draft = this.draft;
    if (draft && this._draftMovable(draft, deviceNow)) {
      draft.screenX = screenX;
      draft.screenY = screenY;
      return;
    }

    const team =
      shootingTeam ?? shootingTeamForTap(screenX, this.viewPeriod, this.sides);
    const tappedAt = toServerTime(deviceNow, this.clockOffset ?? 0);
    const situation = situationFor(this.pulledGoalies, team, this.viewPeriod);
    this.gameTimeInvalid = false;
    this.lastFreeHit = null;
    this.draft = {
      client_uuid: newClientUuid(),
      kind: 'shot',
      tapped_device_ms: deviceNow,
      tapped_at: tappedAt,
      screenX,
      screenY,
      team,
      period: this.viewPeriod,
      game_time: '',
      result: null,
      shooter_player_id: null,
      goalkeeper_player_id: situation.empty_net
        ? null
        : this._goalkeeperFor(otherTeam(team)),
      from_free_hit: followsFreeHit(this.allShots, team, tappedAt),
      fromFreeHitTouched: false,
      from_penalty_shot: false,
      ...situation,
      isEdit: false,
    };
  }

  public setDraftTeam(team: ShotTeam): void {
    if (!this.draft || this.draft.team === team) return;
    this.draft.team = team;
    this.draft.shooter_player_id = null;
    // Die Torwartsituation hängt am Team: Wer eben aufs leere Tor schoss,
    // schießt nach dem Tausch mit 6 gegen 5 und umgekehrt.
    if (this.draft.kind === 'shot' && !this.draft.from_penalty_shot) {
      Object.assign(
        this.draft,
        situationFor(this.pulledGoalies, team, this.draft.period)
      );
      if (this.draft.empty_net && this.draft.result === 'saved') {
        this.draft.result = null;
      }
    }
    this.draft.goalkeeper_player_id = this.draft.empty_net
      ? null
      : this._goalkeeperFor(otherTeam(team));
    if (
      this.draft.kind === 'shot' &&
      !this.draft.fromFreeHitTouched &&
      !this.draft.from_penalty_shot
    ) {
      this.draft.from_free_hit = followsFreeHit(
        this.allShots,
        team,
        this.draft.tapped_at
      );
    }
  }

  public toggleDraftFromFreeHit(): void {
    if (!this.draft || this.draft.kind !== 'shot') return;
    this.draft.from_free_hit = !this.draft.from_free_hit;
    this.draft.fromFreeHitTouched = true;
    if (this.draft.from_free_hit) this.draft.from_penalty_shot = false;
  }

  /**
   * Strafschuss (Feedback #61): nie aus Freischlag, nie geblockt und immer
   * gegen den Torhüter. Einschalten räumt deshalb, was dem widerspricht, und
   * holt den Torhüter zurück.
   */
  public toggleDraftPenaltyShot(): void {
    const draft = this.draft;
    if (!draft || draft.kind !== 'shot') return;
    draft.from_penalty_shot = !draft.from_penalty_shot;
    if (!draft.from_penalty_shot) return;

    draft.from_free_hit = false;
    draft.fromFreeHitTouched = true;
    draft.extra_attacker = false;
    if (draft.result === 'blocked') draft.result = null;
    if (draft.empty_net) {
      draft.empty_net = false;
      draft.goalkeeper_player_id = this._goalkeeperFor(otherTeam(draft.team));
    }
  }

  /** 6 gegen 5 für diesen Schuss (Feedback #64). */
  public toggleDraftExtraAttacker(): void {
    const draft = this.draft;
    if (!draft || draft.kind !== 'shot') return;
    draft.extra_attacker = !draft.extra_attacker;
    if (draft.extra_attacker) draft.from_penalty_shot = false;
  }

  /**
   * Aufs leere Tor für diesen Schuss (Feedback #63), die Kachel „Leeres Tor“
   * bei den Torhütern. Ohne Torhüter gibt es keine Parade.
   */
  public toggleDraftEmptyNet(): void {
    const draft = this.draft;
    if (!draft || draft.kind !== 'shot') return;
    draft.empty_net = !draft.empty_net;
    if (draft.empty_net) {
      draft.goalkeeper_player_id = null;
      draft.from_penalty_shot = false;
      if (draft.result === 'saved') draft.result = null;
    } else {
      draft.goalkeeper_player_id = this._goalkeeperFor(otherTeam(draft.team));
    }
  }

  // --- Freischläge (fe#589) ----------------------------------------------------

  /**
   * Freischlag speichern, ohne Entwurf. Ein offener Schuss-Entwurf bleibt
   * dabei unangetastet; die Rückmeldung mit „Rückgängig“ steht dann über dem
   * Entwurf.
   */
  public recordFreeHit(
    team: ShotTeam,
    screenX: number,
    screenY: number,
    deviceNow = Date.now()
  ): void {
    if (!this.buffer) return;

    const entry: LastFreeHit = {
      client_uuid: newClientUuid(),
      team,
      period: this.viewPeriod,
      screenX,
      screenY,
    };
    this.buffer.upsert(
      this._freeHitInput(entry, toServerTime(deviceNow, this.clockOffset ?? 0))
    );
    this.lastFreeHit = entry;
    this._autoFlush();
  }

  /** Letzten Freischlag dem anderen Team zuschreiben. */
  public swapLastFreeHitTeam(): void {
    const last = this.lastFreeHit;
    const saved = last
      ? this.allShots.find((shot) => shot.client_uuid === last.client_uuid)
      : null;
    if (!last || !saved || !this.buffer) {
      this.lastFreeHit = null;
      return;
    }
    // Die Position ist auf die Angriffsrichtung des Teams normiert und muss
    // mit dem Team neu gerechnet werden.
    this.lastFreeHit = { ...last, team: otherTeam(last.team) };
    this.buffer.upsert(
      this._freeHitInput(this.lastFreeHit, saved.tapped_at, saved.game_time)
    );
    this._autoFlush();
  }

  public undoLastFreeHit(): void {
    const last = this.lastFreeHit;
    this.lastFreeHit = null;
    if (last) this.deleteShot(last.client_uuid);
  }

  public dismissLastFreeHit(): void {
    this.lastFreeHit = null;
  }

  private _freeHitInput(
    entry: LastFreeHit,
    tappedAt: string,
    gameTime = ''
  ): ShotInput {
    const position = toAttackDirection(
      { x: entry.screenX, y: entry.screenY },
      attacksRight(entry.team, entry.period, this.sides)
    );
    return {
      client_uuid: entry.client_uuid,
      kind: 'free_hit',
      team: entry.team,
      period: entry.period,
      game_time: gameTime,
      tapped_at: tappedAt,
      x: position.x,
      y: position.y,
      result: null,
      shooter_player_id: null,
      goalkeeper_player_id: null,
      from_free_hit: false,
    };
  }

  // --- Szene vormerken (api#838) ---------------------------------------------

  /**
   * Ein Tipp merkt den Moment für die Highlights vor: Großchance, Parade,
   * Rudelbildung, alles neben den Toren. Kein Team, keine Position, kein
   * Entwurf; der Zeitpunkt ist der des Tipps. Ein offener Schuss-Entwurf
   * bleibt unangetastet.
   */
  public recordMark(deviceNow = Date.now()): void {
    if (!this.buffer) return;
    const clientUuid = newClientUuid();
    this.buffer.upsert({
      client_uuid: clientUuid,
      kind: 'mark',
      team: null,
      period: this.viewPeriod,
      game_time: '',
      tapped_at: toServerTime(deviceNow, this.clockOffset ?? 0),
      x: null,
      y: null,
      result: null,
      shooter_player_id: null,
      goalkeeper_player_id: null,
      from_free_hit: false,
    });
    this.lastMark = clientUuid;
    this._autoFlush();
  }

  public undoLastMark(): void {
    const last = this.lastMark;
    this.lastMark = null;
    if (last) this.deleteShot(last);
  }

  public dismissLastMark(): void {
    this.lastMark = null;
  }

  /**
   * Ergebnis wählen. Widerspricht es einer Kennung, gewinnt das Ergebnis:
   * Gehalten heißt, es stand ein Torhüter im Tor; einen Strafschuss blockt
   * niemand.
   */
  public setDraftResult(result: ShotResult): void {
    const draft = this.draft;
    if (!draft) return;
    draft.result = result;
    if (result === 'saved' && draft.empty_net) {
      draft.empty_net = false;
      draft.goalkeeper_player_id = this._goalkeeperFor(otherTeam(draft.team));
    }
    if (result === 'blocked') draft.from_penalty_shot = false;
  }

  public setDraftShooter(playerId: number | null): void {
    if (!this.draft) return;
    this.draft.shooter_player_id =
      this.draft.shooter_player_id === playerId ? null : playerId;
  }

  /**
   * Torhüter wählen. Erneutes Tippen auf den gewählten hebt die Wahl auf:
   * „Torhüter unbekannt“, nicht leeres Tor. Das bedeutete die Kachel
   * „Leeres Tor“ früher; sie setzt jetzt `empty_net`.
   */
  public setDraftGoalkeeper(playerId: number | null): void {
    if (!this.draft) return;
    if (playerId !== null && this.draft.goalkeeper_player_id === playerId) {
      playerId = null;
    }
    this.draft.goalkeeper_player_id = playerId;
    this._goalkeeperChoice[otherTeam(this.draft.team)] = playerId;
    // Ein gewählter Torhüter steht im Tor.
    if (playerId !== null) this.draft.empty_net = false;
  }

  public cancelDraft(): void {
    this.draft = null;
    this.gameTimeInvalid = false;
    this._afterDraftClosed();
  }

  /** Ein Schuss braucht ein Ergebnis, ein Freischlag nicht. */
  get canSaveDraft(): boolean {
    return (
      !!this.draft && (this.draft.kind === 'free_hit' || !!this.draft.result)
    );
  }

  public saveDraft(): void {
    const draft = this.draft;
    if (!draft || !this.canSaveDraft || !this.buffer) return;

    const gameTime = normalizeGameTime(draft.game_time);
    if (gameTime === null) {
      this.gameTimeInvalid = true;
      return;
    }

    const position = toAttackDirection(
      { x: draft.screenX, y: draft.screenY },
      attacksRight(draft.team, draft.period, this.sides)
    );
    const freeHit = draft.kind === 'free_hit';
    const shot: ShotInput = consistentShotFlags({
      client_uuid: draft.client_uuid,
      kind: draft.kind,
      team: draft.team,
      period: draft.period,
      game_time: gameTime,
      tapped_at:
        draft.tapped_device_ms === null
          ? draft.tapped_at
          : toServerTime(draft.tapped_device_ms, this.clockOffset ?? 0),
      x: position.x,
      y: position.y,
      // Ein Freischlag hat weder Ergebnis noch Personen, die API weist sie
      // dort ab.
      result: freeHit ? null : draft.result,
      // Die API weist IDs ab, die nicht in der Aufstellung des jeweiligen
      // Teams stehen (Schütze: schießendes, Torhüter: verteidigendes Team).
      shooter_player_id: freeHit
        ? null
        : this._inLineup(draft.team, draft.shooter_player_id),
      goalkeeper_player_id: freeHit
        ? null
        : this._inLineup(otherTeam(draft.team), draft.goalkeeper_player_id),
      from_free_hit: !freeHit && draft.from_free_hit,
      from_penalty_shot: !freeHit && draft.from_penalty_shot,
      empty_net: !freeHit && draft.empty_net,
      extra_attacker: !freeHit && draft.extra_attacker,
    });

    this.buffer.upsert(shot);
    this.draft = null;
    this.gameTimeInvalid = false;
    this._afterDraftClosed();
    this._autoFlush();
  }

  public editShot(shot: DisplayedShot): void {
    // Eine vorgemerkte Szene hat nichts zu korrigieren, nur zu löschen.
    if (!isPlaced(shot)) return;
    const screen = fromAttackDirection(
      { x: shot.x, y: shot.y },
      attacksRight(shot.team, shot.period, this.sides)
    );
    this.gameTimeInvalid = false;
    // Nur beim ersten Öffnen merken: Wer von einer Korrektur direkt in die
    // nächste wechselt, soll danach trotzdem zum Ausgangspunkt zurück.
    if (!this.draft?.isEdit) this._periodBeforeEdit = this.viewPeriod;
    this.viewPeriod = shot.period;
    this.lastFreeHit = null;
    this.draft = {
      client_uuid: shot.client_uuid,
      kind: isFreeHit(shot) ? 'free_hit' : 'shot',
      tapped_device_ms: null,
      tapped_at: shot.tapped_at,
      screenX: screen.x,
      screenY: screen.y,
      team: shot.team,
      period: shot.period,
      game_time: shot.game_time ?? '',
      result: shot.result,
      shooter_player_id: shot.shooter_player_id ?? null,
      goalkeeper_player_id: shot.goalkeeper_player_id ?? null,
      from_free_hit: shot.from_free_hit ?? false,
      fromFreeHitTouched: true,
      from_penalty_shot: shot.from_penalty_shot ?? false,
      empty_net: shot.empty_net ?? false,
      extra_attacker: shot.extra_attacker ?? false,
      isEdit: true,
    };
  }

  public deleteShot(clientUuid: string): void {
    if (!this.buffer) return;
    const knownToServer = this.serverShots.some(
      (shot) => shot.client_uuid === clientUuid
    );
    this.buffer.remove(clientUuid, knownToServer);
    if (this.lastFreeHit?.client_uuid === clientUuid) this.lastFreeHit = null;
    if (this.lastMark === clientUuid) this.lastMark = null;
    if (this.draft?.client_uuid === clientUuid) {
      this.draft = null;
      this._afterDraftClosed();
    }
    this._autoFlush();
  }

  private _goalkeeperFor(team: ShotTeam): number | null {
    if (team in this._goalkeeperChoice) {
      return this._inLineup(team, this._goalkeeperChoice[team]);
    }
    return this.game
      ? this._inLineup(team, defaultGoalkeeperId(this.game, team))
      : null;
  }

  private _inLineup(
    team: ShotTeam,
    playerId: number | null | undefined
  ): number | null {
    if (!playerId) return null;
    return (this.game?.players?.[team] ?? []).some(
      (player) => player.player_id === playerId
    )
      ? playerId
      : null;
  }

  // --- Vollbild -----------------------------------------------------------------

  public toggleFullscreen(): void {
    if (this.fullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  /**
   * Die Ebene (fixiert über Seitenmenü, Kopf und Spielberichtsschritten, Seite
   * dahinter gesperrt) trägt das Vollbild allein. Die Fullscreen-API kommt
   * dazu, wo der Browser sie für Elemente anbietet; fehlt sie (iPhone) oder
   * lehnt der Browser ab, bleibt es still bei der Ebene.
   */
  public enterFullscreen(): void {
    if (this.fullscreen) return;
    this.fullscreen = true;
    this._cdr.markForCheck();
    const body = this._document.body;
    if (body) {
      this._bodyOverflowBefore = body.style.overflow;
      body.style.overflow = 'hidden';
    }
    const root = this._root?.nativeElement;
    if (!root || typeof root.requestFullscreen !== 'function') return;
    try {
      // Ältere Browser geben kein Promise zurück.
      void Promise.resolve(root.requestFullscreen()).catch(() => undefined);
    } catch {
      // Ohne Fullscreen-API bleibt die Ebene.
    }
  }

  public exitFullscreen(): void {
    if (!this.fullscreen) return;
    this.fullscreen = false;
    this._cdr.markForCheck();
    const body = this._document.body;
    if (body && this._bodyOverflowBefore !== null) {
      body.style.overflow = this._bodyOverflowBefore;
    }
    this._bodyOverflowBefore = null;
    this.fullscreenNotices = [];
    if (this._nativeFullscreen) this._leaveNativeFullscreen();
  }

  get nativeFullscreen(): boolean {
    return this._nativeFullscreen;
  }

  /**
   * Spiegelt Meldungen der Seite, solange das Browser-Vollbild nur die
   * Erfassung zeigt. Dieselben Regeln wie fb-notification: gezieltes
   * Wegräumen per `remove`, leere Meldung räumt alles, gleicher Text nur
   * einmal, `autoClose` nach drei Sekunden.
   */
  private _mirrorNotice(notice: UserNotification): void {
    if (notice.remove !== undefined) {
      this.fullscreenNotices = this.fullscreenNotices.filter(
        (entry) => entry.message !== notice.remove
      );
    } else if (!notice.message) {
      this.fullscreenNotices = [];
    } else if (this._nativeFullscreen) {
      if (
        !this.fullscreenNotices.some(
          (entry) => entry.message === notice.message
        )
      ) {
        this.fullscreenNotices = [...this.fullscreenNotices, notice];
      }
      if (notice.autoClose) {
        setTimeout(() => this.dismissFullscreenNotice(notice), 3000);
      }
    }
    this._cdr.markForCheck();
  }

  public dismissFullscreenNotice(notice: UserNotification): void {
    this.fullscreenNotices = this.fullscreenNotices.filter(
      (entry) => entry !== notice
    );
    this._cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void {
    if (this.fullscreen) this.exitFullscreen();
  }

  /**
   * Verlässt jemand das Browser-Vollbild (Esc am Rechner, Wischgeste oder
   * Zurück am Tablet), endet auch die Ebene: Die Esc-Taste erreicht die Seite
   * im Browser-Vollbild nicht, und zwei Schritte zum Beenden wären
   * überraschend. Gezählt wird nur ein Vollbild, das wirklich auf der
   * Erfassung lag.
   */
  @HostListener('document:fullscreenchange')
  public onFullscreenChange(): void {
    const root = this._root?.nativeElement;
    if (root && this._document.fullscreenElement === root) {
      this._nativeFullscreen = true;
      // Schon wieder beendet, bevor der Browser umgeschaltet hatte.
      if (!this.fullscreen) this._leaveNativeFullscreen();
      return;
    }
    if (!this._nativeFullscreen) return;
    this._nativeFullscreen = false;
    this.exitFullscreen();
  }

  private _leaveNativeFullscreen(): void {
    this._nativeFullscreen = false;
    if (this._document.fullscreenElement !== this._root?.nativeElement) return;
    try {
      void Promise.resolve(this._document.exitFullscreen()).catch(
        () => undefined
      );
    } catch {
      // Dann beendet der Browser sein Vollbild selbst (Esc, Wischgeste).
    }
  }

  // --- Übertragung ------------------------------------------------------------

  get syncing(): boolean {
    return this._gameId !== null && this._sync.state(this._gameId).syncing;
  }

  get syncBlocked(): boolean {
    return this._gameId !== null && this._sync.state(this._gameId).blocked;
  }

  get syncForbidden(): boolean {
    return this._gameId !== null && this._sync.state(this._gameId).forbidden;
  }

  /**
   * Senden ohne ausdrücklichen Auftrag (Speichern, Löschen, Takt, wieder
   * online). Nach einer Absage nicht: Dann wird nur gepuffert, gesendet wird
   * erst über „Jetzt senden“.
   */
  private _autoFlush(): void {
    if (this._gameId === null) return;
    void this._sync
      .flushIfAllowed(this._gameId)
      .then(() => this._cdr.markForCheck());
  }

  public flush(): Promise<void> {
    if (this._gameId === null) return Promise.resolve();
    return this._sync.flush(this._gameId).then(() => this._cdr.markForCheck());
  }

  public retryNow(): void {
    if (this._gameId === null) return;
    void this._sync.retry(this._gameId).then(() => this._cdr.markForCheck());
  }

  public loadShots(): void {
    const gameId = this._gameId;
    if (gameId === null) return;
    this._shotService.getShots(gameId).subscribe({
      next: (shots) => {
        this._applyServerShots(gameId, shots);
        this._cdr.markForCheck();
      },
      // Ohne Verbindung bleibt die Liste beim lokalen Stand.
      error: () => undefined,
    });
  }

  private _applyServerShots(gameId: number, shots: Shot[]): void {
    if (gameId !== this._gameId) return;
    this.serverShots = shots;
  }

  // --- Anzeige -----------------------------------------------------------------

  /** Markierungen bleiben auf dem Bildschirm gleich groß, auch auf dem KF. */
  get markerScale(): number {
    return this.field.length / 40;
  }

  private _shotsCache: {
    server: Shot[];
    buffer: ShotBuffer | null;
    version: number;
    shots: DisplayedShot[];
  } | null = null;

  get allShots(): DisplayedShot[] {
    const cache = this._shotsCache;
    const version = this.buffer?.version ?? 0;
    if (
      cache &&
      cache.server === this.serverShots &&
      cache.buffer === this.buffer &&
      cache.version === version
    ) {
      return cache.shots;
    }
    const shots = mergeShots(
      this.serverShots,
      this.buffer?.upserts ?? [],
      this.buffer?.deletes ?? []
    );
    this._shotsCache = {
      server: this.serverShots,
      buffer: this.buffer,
      version,
      shots,
    };
    return shots;
  }

  get recentShots(): DisplayedShot[] {
    return this.allShots.slice(0, RECENT_SHOTS);
  }

  get pendingCount(): number {
    return this.buffer?.size ?? 0;
  }

  /** Markierungen des angezeigten Abschnitts in Bildschirmkoordinaten. */
  get fieldMarkers(): {
    x: number;
    y: number;
    freeHit: boolean;
    result: ShotResult | null;
    pending: boolean;
  }[] {
    return this.allShots
      .filter(isPlaced)
      .filter((shot) => shot.period === this.viewPeriod)
      .map((shot) => {
        const screen = fromAttackDirection(
          { x: shot.x, y: shot.y },
          attacksRight(shot.team, shot.period, this.sides)
        );
        return {
          ...screen,
          freeHit: isFreeHit(shot),
          result: shot.result,
          pending: shot.pending,
        };
      });
  }

  get linkCandidates(): GoalLinkCandidate[] {
    return goalLinkCandidates(this.game?.events, this.serverShots);
  }

  public linkShot(shot: Shot, goal: GameEvent): void {
    const gameId = this._gameId;
    if (gameId === null) return;
    this.linkError = false;
    this._shotService
      .linkShot(gameId, shot.client_uuid, goal.event_id)
      .subscribe({
        next: (shots) => {
          this._applyServerShots(gameId, shots);
          this._cdr.markForCheck();
        },
        // 403/404 meldet der Interceptor hier nicht; übrige 4xx zeigt er an.
        error: (err) => {
          if (gameId !== this._gameId) return;
          if ([403, 404].includes(err?.status)) this.linkError = true;
          this._cdr.markForCheck();
        },
      });
  }

  public teamName(team: ShotTeam | null): string {
    if (!team) return '';
    return (
      (team === 'home'
        ? this.game?.home_team_short_name || this.game?.home_team_name
        : this.game?.guest_team_short_name || this.game?.guest_team_name) ?? ''
    );
  }

  public lineup(team: ShotTeam): GamePlayerEntry[] {
    return [...(this.game?.players?.[team] ?? [])].sort(
      (a, b) => (a.trikot_number ?? 0) - (b.trikot_number ?? 0)
    );
  }

  public fieldPlayers(team: ShotTeam): GamePlayerEntry[] {
    return this.lineup(team).filter((player) => !player.goalkeeper);
  }

  /** Torhüter des Teams; ohne gemeldeten Torhüter der ganze Kader. */
  public goalkeepers(team: ShotTeam): GamePlayerEntry[] {
    const keepers = this.lineup(team).filter((player) => player.goalkeeper);
    return keepers.length ? keepers : this.lineup(team);
  }

  public trikotNumber(
    team: ShotTeam | null,
    playerId: number | null | undefined
  ): string {
    if (!playerId || !team) return '';
    const player = (this.game?.players?.[team] ?? []).find(
      (entry) => entry.player_id === playerId
    );
    return player ? '#' + player.trikot_number : '';
  }

  /** Gerätezeit eines Tipps in Serverzeit, wie sie gespeichert würde. */
  public toServerTimeIso(deviceMs: number): string {
    return toServerTime(deviceMs, this.clockOffset ?? 0);
  }

  public tappedClock(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  public isFreeHit(shot: Pick<ShotInput, 'kind'>): boolean {
    return isFreeHit(shot);
  }

  public isMark(shot: Pick<ShotInput, 'kind'>): boolean {
    return isMark(shot);
  }

  public isUnplacedSave(
    shot: Pick<ShotInput, 'kind' | 'result' | 'x' | 'y'>
  ): boolean {
    return isUnplacedSave(shot);
  }

  /** Nur Einträge mit Stelle auf dem Feld lassen sich korrigieren. */
  public canEdit(shot: DisplayedShot): boolean {
    return isPlaced(shot);
  }

  public trackShot(_index: number, shot: { client_uuid: string }): string {
    return shot.client_uuid;
  }
}
