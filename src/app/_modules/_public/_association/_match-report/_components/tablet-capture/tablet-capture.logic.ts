import {
  Game,
  GameEvent,
  PeriodTitles,
  Shot,
  ShotInput,
  ShotTeam,
} from '@floorball/types';

/**
 * Reine Rechenlogik des Tabletmodus (fe#344), getrennt von der Ansicht, damit
 * sie ohne Oberfläche prüfbar ist.
 */

// --- Serverzeit ------------------------------------------------------------

export interface ClockSample {
  // Gerätezeit (ms) beim Absenden und beim Eintreffen der Antwort.
  sentAt: number;
  receivedAt: number;
  // Antwort von GET server_time.
  serverNow: string;
}

/**
 * Abweichung Server minus Gerät in Millisekunden aus einer Messung.
 *
 * Der Server hat seine Uhr irgendwann zwischen Absenden und Eintreffen
 * gelesen. Angenommen wird die Mitte, also der halbe Round-Trip: Bei einer
 * Antwort nach 400 ms liegt der Fehler damit höchstens bei 200 ms, und nur
 * dann, wenn Hin- und Rückweg sehr ungleich lang waren.
 */
export function clockOffsetMs(sample: ClockSample): number | null {
  const server = Date.parse(sample.serverNow);
  if (isNaN(server) || sample.receivedAt < sample.sentAt) return null;

  const midpoint = sample.sentAt + (sample.receivedAt - sample.sentAt) / 2;
  return Math.round(server - midpoint);
}

/**
 * Von mehreren Messungen gilt die mit dem kürzesten Round-Trip: Ihr
 * Fehlerfenster ist am kleinsten. Ein Ausreißer (WLAN hängt kurz) fällt so
 * heraus, statt in einen Mittelwert einzugehen.
 */
export function bestClockOffset(samples: ClockSample[]): number | null {
  const valid = samples
    .map((sample) => ({
      rtt: sample.receivedAt - sample.sentAt,
      offset: clockOffsetMs(sample),
    }))
    .filter(
      (entry): entry is { rtt: number; offset: number } => entry.offset !== null
    )
    .sort((a, b) => a.rtt - b.rtt);

  return valid.length ? valid[0].offset : null;
}

/** Gerätezeit in Serverzeit als ISO-String mit Millisekunden. */
export function toServerTime(deviceNowMs: number, offsetMs: number): string {
  return new Date(deviceNowMs + offsetMs).toISOString();
}

// --- Spielfeld und Angriffsrichtung ------------------------------------------

export interface FieldPoint {
  x: number;
  y: number;
}

function clamp01(value: number): number {
  if (!isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Bildschirmposition (0..1 von links nach rechts und von oben nach unten) in
 * die Angriffsrichtung des schießenden Teams umrechnen.
 *
 * Beide Achsen laufen über das ganze Feld von Bande zu Bande, je nach
 * Feldgröße 40 x 20 m (GF) oder 28 x 16 m (KF): x = 0 ist die Bande hinter
 * dem eigenen Tor, x = 1 die Bande hinter dem gegnerischen Tor, y = 0 die
 * linke Seitenbande aus Sicht des Angreifers. Das SVG der Erfassung bildet
 * genau diese Fläche ab (viewBox in Metern, siehe field-geometry.ts), die
 * Umrechnung braucht die Feldgröße deshalb nicht.
 *
 * Greift das Team nach rechts an, ist die linke Bande x = 0 und die obere
 * Seitenbande y = 0. Greift es nach links an, ist das Bild um 180 Grad
 * gedreht. Die Umrechnung ist ihre eigene Umkehrung, `fromAttackDirection`
 * ist deshalb dieselbe Funktion.
 */
export function toAttackDirection(
  screen: FieldPoint,
  attacksRight: boolean
): FieldPoint {
  const x = clamp01(screen.x);
  const y = clamp01(screen.y);
  return attacksRight
    ? { x: round4(x), y: round4(y) }
    : { x: round4(1 - x), y: round4(1 - y) };
}

export const fromAttackDirection = toAttackDirection;

export type SideConfig = Record<string, ShotTeam>;

/**
 * Welches Team greift im Abschnitt von links nach rechts an? Ohne eigene
 * Einstellung das Heimteam in den ungeraden Abschnitten, nach jedem
 * Abschnitt wird gewechselt.
 */
export function leftToRightTeam(period: number, sides: SideConfig): ShotTeam {
  const configured = sides[String(period)];
  if (configured === 'home' || configured === 'guest') return configured;
  return period % 2 === 1 ? 'home' : 'guest';
}

export function otherTeam(team: ShotTeam): ShotTeam {
  return team === 'home' ? 'guest' : 'home';
}

export function attacksRight(
  team: ShotTeam,
  period: number,
  sides: SideConfig
): boolean {
  return leftToRightTeam(period, sides) === team;
}

/**
 * Vorschlag für das schießende Team aus der angetippten Hälfte: Ein Schuss in
 * der rechten Hälfte geht auf das rechte Tor, kommt also vom Team, das nach
 * rechts angreift. Konter von der eigenen Hälfte sind selten genug, dass ein
 * Umstellen in der Erfassung reicht.
 */
export function shootingTeamForTap(
  screenX: number,
  period: number,
  sides: SideConfig
): ShotTeam {
  const rightTeam = leftToRightTeam(period, sides);
  return screenX >= 0.5 ? rightTeam : otherTeam(rightTeam);
}

// --- Spielzeit und Abschnitte -------------------------------------------------

/**
 * Spielzeit aus der Eingabe in 'm:ss' bringen. Leer bleibt leer (die Zeit ist
 * optional). Erlaubt sind '12:34', '12.34' und reine Ziffern ('1234', '534').
 * Ungültiges ergibt null.
 */
export function normalizeGameTime(
  input: string | null | undefined
): string | null {
  const value = (input ?? '').trim();
  if (value === '') return '';

  let minutes: number;
  let seconds: number;
  const separated = value.match(/^(\d{1,3})[:.,](\d{2})$/);
  if (separated) {
    minutes = parseInt(separated[1], 10);
    seconds = parseInt(separated[2], 10);
  } else if (/^\d{3,5}$/.test(value)) {
    minutes = parseInt(value.slice(0, -2), 10);
    seconds = parseInt(value.slice(-2), 10);
  } else {
    return null;
  }

  if (seconds > 59) return null;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

/** Abschnitte, in denen gespielt wird, ohne Pausen und Penalty-Schießen. */
export function playablePeriods(
  periodTitles: PeriodTitles[] | undefined
): number[] {
  const periods = (periodTitles ?? [])
    .filter(
      (title) =>
        title.running &&
        title.status_id !== 'penalty_shots' &&
        Number.isInteger(title.period)
    )
    .map((title) => title.period);
  const unique = Array.from(new Set(periods)).sort((a, b) => a - b);
  return unique.length ? unique : [1, 2, 3];
}

// --- Aufstellung --------------------------------------------------------------

/**
 * Torhüter des verteidigenden Teams: zuerst die Startaufstellung (Position
 * „goal"), sonst der erste als Torhüter gemeldete Spieler im Kader.
 */
export function defaultGoalkeeperId(
  game: Pick<Game, 'players' | 'starting_players'>,
  team: ShotTeam
): number | null {
  const starter = game.starting_players?.[team]?.find(
    (player) => player.position === 'goal'
  );
  if (starter?.player_id) return starter.player_id;

  const keeper = (game.players?.[team] ?? []).find(
    (player) => player.goalkeeper
  );
  return keeper?.player_id ?? null;
}

// --- Schussliste und Verknüpfung -----------------------------------------------

/**
 * Was die Erfassung anzeigt: der letzte Serverstand, darüber die lokal
 * gepufferten Änderungen, ohne die vorgemerkten Löschungen.
 */
export function mergeShots(
  serverShots: Shot[],
  pendingUpserts: ShotInput[],
  pendingDeletes: string[]
): (ShotInput & { event_id: number | null; pending: boolean })[] {
  const byUuid = new Map<
    string,
    ShotInput & { event_id: number | null; pending: boolean }
  >();
  for (const shot of serverShots) {
    byUuid.set(shot.client_uuid, { ...shot, pending: false });
  }
  for (const shot of pendingUpserts) {
    const known = byUuid.get(shot.client_uuid);
    byUuid.set(shot.client_uuid, {
      ...shot,
      event_id: known?.event_id ?? null,
      pending: true,
    });
  }
  for (const uuid of pendingDeletes) byUuid.delete(uuid);

  return Array.from(byUuid.values()).sort((a, b) =>
    b.tapped_at.localeCompare(a.tapped_at)
  );
}

// --- Freischläge (fe#589) ---------------------------------------------------

/** Liegt ein Freischlag so kurz vor dem Schuss, gilt der Schuss als „aus Freischlag“. */
export const FREE_HIT_SHOT_WINDOW_MS = 10000;

export function isFreeHit(shot: Pick<ShotInput, 'kind'>): boolean {
  return shot.kind === 'free_hit';
}

/** Vorgemerkte Szene (api#838): nur ein Zeitpunkt, ohne Team und Position. */
export function isMark(shot: Pick<ShotInput, 'kind'>): boolean {
  return shot.kind === 'mark';
}

/**
 * Hat der Eintrag eine Stelle auf dem Feld? Schüsse und Freischläge immer,
 * eine vorgemerkte Szene nie. Nur solche Einträge lassen sich zeichnen und
 * korrigieren.
 */
export function isPlaced<T extends Pick<ShotInput, 'team' | 'x' | 'y'>>(
  shot: T
): shot is T & { team: ShotTeam; x: number; y: number } {
  return shot.team !== null && shot.x !== null && shot.y !== null;
}

/**
 * Vorbelegung des Schalters „aus Freischlag“: Gab es höchstens
 * FREE_HIT_SHOT_WINDOW_MS vor dem Antippen des Schusses einen Freischlag
 * desselben Teams? Verglichen wird `tapped_at`, also der Zeitpunkt in der
 * Halle, nicht die Spielzeit.
 */
export function followsFreeHit(
  shots: Pick<ShotInput, 'kind' | 'team' | 'tapped_at'>[],
  team: ShotTeam,
  tappedAt: string
): boolean {
  const shotMs = Date.parse(tappedAt);
  if (isNaN(shotMs)) return false;
  return shots.some((entry) => {
    if (!isFreeHit(entry) || entry.team !== team) return false;
    const freeHitMs = Date.parse(entry.tapped_at);
    return (
      !isNaN(freeHitMs) &&
      freeHitMs <= shotMs &&
      shotMs - freeHitMs <= FREE_HIT_SHOT_WINDOW_MS
    );
  });
}

// --- Strafschuss und Torwartsituation (Feedback #61, #63, #64) ---------------

/**
 * Teams, die gerade ohne Torhüter spielen („Torwart raus“), je Team mit dem
 * Abschnitt, in dem umgeschaltet wurde. Der Schalter gilt nur in diesem
 * Abschnitt: Nach einem Abschnittswechsel steht der Torhüter wieder im Tor,
 * ohne dass jemand zurückschalten muss.
 */
export type PulledGoalies = Partial<Record<ShotTeam, number>>;

export function goaliePulled(
  pulled: PulledGoalies,
  team: ShotTeam,
  period: number
): boolean {
  return pulled[team] === period;
}

/**
 * Vorbelegung eines neuen Schusses aus den Schaltern: aufs leere Tor, wenn
 * der Gegner ohne Torhüter spielt, 6 gegen 5, wenn das schießende Team ohne
 * eigenen spielt. Beides kann zugleich gelten.
 */
export function situationFor(
  pulled: PulledGoalies,
  shootingTeam: ShotTeam,
  period: number
): { empty_net: boolean; extra_attacker: boolean } {
  return {
    empty_net: goaliePulled(pulled, otherTeam(shootingTeam), period),
    extra_attacker: goaliePulled(pulled, shootingTeam, period),
  };
}

type ShotFlags = Pick<
  ShotInput,
  | 'kind'
  | 'result'
  | 'goalkeeper_player_id'
  | 'from_free_hit'
  | 'from_penalty_shot'
  | 'empty_net'
  | 'extra_attacker'
>;

/**
 * Bringt die Kennungen eines Schusses in eine Form, die die API annimmt. Ein
 * abgewiesener Schuss hielte sonst den ganzen Puffer an (422). Regeln wie in
 * der API: Kennungen nur an Schüssen; ein Strafschuss nie aus Freischlag, nie
 * geblockt und nie bei herausgenommenem Torhüter; aufs leere Tor ohne
 * Torhüter und nie gehalten. Widerspricht eine Kennung dem Ergebnis, gewinnt
 * das Ergebnis: Ein gehaltener Schuss ging nicht aufs leere Tor.
 */
export function consistentShotFlags<T extends ShotFlags>(shot: T): T {
  if ((shot.kind ?? 'shot') !== 'shot') {
    return {
      ...shot,
      from_free_hit: false,
      from_penalty_shot: false,
      empty_net: false,
      extra_attacker: false,
    };
  }
  // Geblockt gibt es beim Strafschuss nicht; das Ergebnis ist die
  // ausdrücklichere Angabe.
  const penalty = !!shot.from_penalty_shot && shot.result !== 'blocked';
  const emptyNet = !penalty && !!shot.empty_net && shot.result !== 'saved';
  return {
    ...shot,
    from_free_hit: !penalty && !!shot.from_free_hit,
    from_penalty_shot: penalty,
    empty_net: emptyNet,
    extra_attacker: !penalty && !!shot.extra_attacker,
    goalkeeper_player_id: emptyNet ? null : (shot.goalkeeper_player_id ?? null),
  };
}

/** Parade aus dem Schnellzähler: gehalten, ohne Feldposition (Feedback #62). */
export function isUnplacedSave(
  shot: Pick<ShotInput, 'kind' | 'result' | 'x' | 'y'>
): boolean {
  return (
    !isFreeHit(shot) &&
    !isMark(shot) &&
    shot.result === 'saved' &&
    shot.x === null &&
    shot.y === null
  );
}

export interface GoalLinkCandidate {
  goal: GameEvent;
  shots: Shot[];
}

/**
 * Torarten ohne Schuss: Ein Eigentor schießt niemand aufs gegnerische Tor
 * (ein abgefälschter Schuss ist kein Eigentor), ein technisches Tor wird
 * zugesprochen. Die API nimmt keine Verknüpfung mit ihnen an. Ein technisches
 * Tor mit „nicht angegeben“ (2000) kommt als goal_type 'not_assigned' und ist
 * nur an technical_goal zu erkennen.
 */
const GOAL_TYPES_WITHOUT_SHOT = ['owngoal', 'technical'];

/**
 * Tore, die mit keinem Schuss verknüpft sind, jeweils mit den noch freien
 * Tor-Schüssen desselben Teams. Leer, wenn es nichts zuzuordnen gibt: Dann
 * hat die automatische Verknüpfung in der API gegriffen. Eigentore und
 * technische Tore erscheinen nie, sie haben keinen Schuss.
 */
export function goalLinkCandidates(
  events: GameEvent[] | undefined,
  shots: Shot[]
): GoalLinkCandidate[] {
  const linked = new Set(
    shots.map((shot) => shot.event_id).filter((id) => id !== null)
  );
  const freeGoalShots = shots.filter(
    (shot) =>
      !isFreeHit(shot) && shot.result === 'goal' && shot.event_id === null
  );

  return (events ?? [])
    .filter(
      (event) =>
        event.event_type === 'goal' &&
        !GOAL_TYPES_WITHOUT_SHOT.includes(event.goal_type ?? '') &&
        !event.technical_goal &&
        !linked.has(event.event_id)
    )
    .map((goal) => ({
      goal,
      // Nur Schüsse desselben Teams (die API weist andere ab), solche aus
      // demselben Abschnitt zuerst.
      shots: freeGoalShots
        .filter((shot) => shot.team === goal.event_team)
        .sort(
          (a, b) =>
            Number(b.period === goal.period) -
              Number(a.period === goal.period) ||
            b.tapped_at.localeCompare(a.tapped_at)
        ),
    }))
    .filter((candidate) => candidate.shots.length > 0);
}

/** crypto.randomUUID gibt es nur in sicherem Kontext; sonst ein Ersatz. */
export function newClientUuid(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
