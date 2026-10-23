import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { Subscription, lastValueFrom, timeout } from 'rxjs';

import { GameShotService, StorageService } from '@floorball/core';
import {
  Game,
  GameEvent,
  GamePlayerEntry,
  Shot,
  ShotInput,
  ShotResult,
  ShotTeam,
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
  SideConfig,
  attacksRight,
  bestClockOffset,
  defaultGoalkeeperId,
  fromAttackDirection,
  goalLinkCandidates,
  leftToRightTeam,
  mergeShots,
  newClientUuid,
  normalizeGameTime,
  otherTeam,
  playablePeriods,
  shootingTeamForTap,
  toAttackDirection,
  toServerTime,
} from './tablet-capture.logic';

export interface ShotDraft {
  client_uuid: string;
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
  isEdit: boolean;
}

export type DisplayedShot = ReturnType<typeof mergeShots>[number];

const CLOCK_OFFSET_KEY = 'tablet_clock_offset';
const SIDES_KEY_PREFIX = 'tablet_sides_';
const RETRY_INTERVAL_MS = 15000;
const CLOCK_SAMPLES = 3;
const CLOCK_TIMEOUT_MS = 5000;
// Ein Tipp gilt als Tipp, solange der Finger sich kaum bewegt; darüber ist es
// ein Wischen (Scrollen am Tablet) und erzeugt keinen Schuss.
const TAP_MAX_MOVE_PX = 12;
// Ein offener Entwurf, der älter ist, wird von einem neuen Tipp nicht mehr
// verschoben, sondern ersetzt: Dann ist es ein neuer Schuss.
const DRAFT_MOVE_WINDOW_MS = 10000;
const RECENT_SHOTS = 8;

/**
 * Erfassungsansicht des Tabletmodus (Beta, fe#344): Spielfeld antippen ergibt
 * einen Schuss, danach Team, Ergebnis und auf Wunsch Schütze und Torhüter als
 * große Kacheln.
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
  // Pause der vorherige). `viewPeriod` folgt ihm bei jeder Änderung; eine
  // Abweichung entsteht nur durch bewusstes Umstellen (Nachträge).
  public gamePeriod = 1;
  // Der Abschnitt des Spiels hat sich geändert, während ein Entwurf offen war.
  // Nachgeführt wird nach dem Speichern oder Verwerfen, damit der Schuss im
  // Abschnitt bleibt, in dem er angetippt wurde.
  public periodChangePending = false;
  public draft: ShotDraft | null = null;
  public gameTimeInvalid = false;

  public clockOffset: number | null = null;
  public clockStatus: 'measuring' | 'ok' | 'stale' | 'unknown' = 'measuring';

  // Meldung, wenn eine Zuordnung abgewiesen wurde (403/404 meldet der
  // Interceptor für diese Endpunkte nicht selbst).
  public linkError = false;

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
    if (this._retryTimer) clearInterval(this._retryTimer);
    this._retryTimer = null;
    this._shotsSubscription?.unsubscribe();
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
    this.linkError = false;
    this._goalkeeperChoice = {};
    this.sides = this._loadSides(gameId);
    this.gamePeriod = this._periodFromGame();
    this.viewPeriod = this.gamePeriod;
    this.periodChangePending = false;
    this._periodBeforeEdit = null;
    this._goalSignature = this._currentGoalSignature();
    this.loadShots();
    this._autoFlush();
  }

  // Dieselbe Regel wie `currentPeriod` im Spielbericht: In der Pause steht
  // dort z. B. 1.5, abgerundet der gerade beendete Abschnitt.
  private _periodFromGame(): number {
    const parsed = Math.floor(this.game?.current_period_title?.period || 0);
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
    if (this.draft) {
      this.periodChangePending = true;
    } else {
      this.viewPeriod = period;
    }
  }

  /** Nach dem Schließen eines Entwurfs (Speichern, Verwerfen, Löschen). */
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

  private _currentGoalSignature(): string {
    return (this.game?.events ?? [])
      .filter((event) => event.event_type === 'goal')
      .map((event) => event.event_id)
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
    this._storage.setItem(
      SIDES_KEY_PREFIX + this._gameId,
      JSON.stringify(this.sides)
    );
  }

  public selectViewPeriod(period: number): void {
    this.viewPeriod = period;
    if (this.draft) this.draft.period = period;
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
    this.startDraft(screenX, screenY, down.deviceNow);
  }

  public onFieldPointerCancel(): void {
    this._pointerDown = null;
  }

  public startDraft(
    screenX: number,
    screenY: number,
    deviceNow = Date.now()
  ): void {
    // Ein frischer Entwurf wird nur verschoben: Wer die Stelle gleich
    // nachbessert, meint denselben Schuss, und dessen Zeitpunkt bleibt. Ein
    // geladener Schuss (Korrektur) wird immer verschoben. Ist ein neuer
    // Entwurf älter als das Zeitfenster, war es ein neuer Schuss: Der alte,
    // nie gespeicherte Entwurf wird verworfen.
    const draft = this.draft;
    if (
      draft &&
      (draft.isEdit ||
        draft.tapped_device_ms === null ||
        deviceNow - draft.tapped_device_ms <= DRAFT_MOVE_WINDOW_MS)
    ) {
      draft.screenX = screenX;
      draft.screenY = screenY;
      return;
    }

    const team = shootingTeamForTap(screenX, this.viewPeriod, this.sides);
    this.gameTimeInvalid = false;
    this.draft = {
      client_uuid: newClientUuid(),
      tapped_device_ms: deviceNow,
      tapped_at: toServerTime(deviceNow, this.clockOffset ?? 0),
      screenX,
      screenY,
      team,
      period: this.viewPeriod,
      game_time: '',
      result: null,
      shooter_player_id: null,
      goalkeeper_player_id: this._goalkeeperFor(otherTeam(team)),
      isEdit: false,
    };
  }

  public setDraftTeam(team: ShotTeam): void {
    if (!this.draft || this.draft.team === team) return;
    this.draft.team = team;
    this.draft.shooter_player_id = null;
    this.draft.goalkeeper_player_id = this._goalkeeperFor(otherTeam(team));
  }

  public setDraftResult(result: ShotResult): void {
    if (this.draft) this.draft.result = result;
  }

  public setDraftShooter(playerId: number | null): void {
    if (!this.draft) return;
    this.draft.shooter_player_id =
      this.draft.shooter_player_id === playerId ? null : playerId;
  }

  public setDraftGoalkeeper(playerId: number | null): void {
    if (!this.draft) return;
    this.draft.goalkeeper_player_id = playerId;
    this._goalkeeperChoice[otherTeam(this.draft.team)] = playerId;
  }

  public cancelDraft(): void {
    this.draft = null;
    this.gameTimeInvalid = false;
    this._afterDraftClosed();
  }

  public saveDraft(): void {
    const draft = this.draft;
    if (!draft || !draft.result || !this.buffer) return;

    const gameTime = normalizeGameTime(draft.game_time);
    if (gameTime === null) {
      this.gameTimeInvalid = true;
      return;
    }

    const position = toAttackDirection(
      { x: draft.screenX, y: draft.screenY },
      attacksRight(draft.team, draft.period, this.sides)
    );
    const shot: ShotInput = {
      client_uuid: draft.client_uuid,
      team: draft.team,
      period: draft.period,
      game_time: gameTime,
      tapped_at:
        draft.tapped_device_ms === null
          ? draft.tapped_at
          : toServerTime(draft.tapped_device_ms, this.clockOffset ?? 0),
      x: position.x,
      y: position.y,
      result: draft.result,
      // Die API weist IDs ab, die nicht in der Aufstellung des jeweiligen
      // Teams stehen (Schütze: schießendes, Torhüter: verteidigendes Team).
      shooter_player_id: this._inLineup(draft.team, draft.shooter_player_id),
      goalkeeper_player_id: this._inLineup(
        otherTeam(draft.team),
        draft.goalkeeper_player_id
      ),
    };

    this.buffer.upsert(shot);
    this.draft = null;
    this.gameTimeInvalid = false;
    this._afterDraftClosed();
    this._autoFlush();
  }

  public editShot(shot: DisplayedShot): void {
    const screen = fromAttackDirection(
      { x: shot.x, y: shot.y },
      attacksRight(shot.team, shot.period, this.sides)
    );
    this.gameTimeInvalid = false;
    // Nur beim ersten Öffnen merken: Wer von einer Korrektur direkt in die
    // nächste wechselt, soll danach trotzdem zum Ausgangspunkt zurück.
    if (!this.draft?.isEdit) this._periodBeforeEdit = this.viewPeriod;
    this.viewPeriod = shot.period;
    this.draft = {
      client_uuid: shot.client_uuid,
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
      isEdit: true,
    };
  }

  public deleteShot(clientUuid: string): void {
    if (!this.buffer) return;
    const knownToServer = this.serverShots.some(
      (shot) => shot.client_uuid === clientUuid
    );
    this.buffer.remove(clientUuid, knownToServer);
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
    result: ShotResult;
    pending: boolean;
  }[] {
    return this.allShots
      .filter((shot) => shot.period === this.viewPeriod)
      .map((shot) => {
        const screen = fromAttackDirection(
          { x: shot.x, y: shot.y },
          attacksRight(shot.team, shot.period, this.sides)
        );
        return { ...screen, result: shot.result, pending: shot.pending };
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

  public teamName(team: ShotTeam): string {
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
    team: ShotTeam,
    playerId: number | null | undefined
  ): string {
    if (!playerId) return '';
    const player = (this.game?.players?.[team] ?? []).find(
      (entry) => entry.player_id === playerId
    );
    return player ? '#' + player.trikot_number : '';
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

  public trackShot(_index: number, shot: { client_uuid: string }): string {
    return shot.client_uuid;
  }
}
