import {
  DetailedStats,
  DetailedStatsFreeHit,
  DetailedStatsShot,
  GameEvent,
  GoalkeeperSaveStats,
  GoalkeeperStats,
  PlayerShotStats,
  ShotResult,
  ShotTeam,
  TeamShotStats,
} from '@floorball/types';
import {
  FIELD_GEOMETRY,
  FieldGeometry,
} from 'src/app/_helpers/_utils/field-geometry';

export const SHOT_RESULTS: readonly ShotResult[] = [
  'goal',
  'saved',
  'blocked',
  'missed',
];

export interface FieldPoint {
  /** Meter von der linken Bande der Darstellung. */
  cx: number;
  /** Meter von der oberen Bande der Darstellung. */
  cy: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Rechnet einen Schuss aus der normierten Angriffsrichtung in die Darstellung
 * um: Heim greift nach rechts an, Gast nach links.
 *
 * Normierung laut API über das ganze Feld von Bande zu Bande (so erfasst
 * auch der Tabletmodus), je nach Feldgröße 40 x 20 m oder 28 x 16 m: x = 0
 * eigene Bande, x = 1 gegnerische Bande, y = 0 links und y = 1 rechts aus Sicht des Angreifers. Für Heim (Blick nach
 * rechts) liegt „links“ oben. Der Gast blickt nach links, für ihn liegt „links“
 * unten. Sein Schuss wird deshalb um den Mittelpunkt gedreht, also x UND y
 * gespiegelt. Spiegelte man nur x, landete ein Schuss von der linken Seite des
 * Gastes auf seiner rechten.
 *
 * Werte außerhalb von 0..1 werden an der Bande abgeschnitten. Das Ergebnis
 * ist in Metern des übergebenen Feldes, ohne Angabe Großfeld.
 */
export function toFieldPoint(
  shot: Pick<DetailedStatsShot, 'team'> & { x: number; y: number },
  field: Pick<FieldGeometry, 'length' | 'width'> = FIELD_GEOMETRY.GF
): FieldPoint {
  const x = shot.team === 'home' ? shot.x : 1 - shot.x;
  const y = shot.team === 'home' ? shot.y : 1 - shot.y;

  return {
    cx: clamp(x * field.length, 0, field.length),
    cy: clamp(y * field.width, 0, field.width),
  };
}

/**
 * Hat der Schuss eine Feldposition? Paraden aus dem Schnellzähler (Feedback
 * #62) haben keine: Sie zählen in Summen und beim Torhüter, gehören aber in
 * keine Schussgrafik.
 */
export function isPlacedShot<T extends Pick<DetailedStatsShot, 'x' | 'y'>>(
  shot: T
): shot is T & { x: number; y: number } {
  return (
    typeof shot.x === 'number' &&
    typeof shot.y === 'number' &&
    isFinite(shot.x) &&
    isFinite(shot.y)
  );
}

/** Schüsse eines Teams, wahlweise nur eines Abschnitts (`null` = alle). */
export function filterShots(
  shots: DetailedStatsShot[],
  team: ShotTeam,
  period: number | null
): DetailedStatsShot[] {
  return shots.filter(
    (shot) => shot.team === team && (period === null || shot.period === period)
  );
}

/** Freischläge eines Teams, wahlweise nur eines Abschnitts (`null` = alle). */
export function filterFreeHits(
  freeHits: DetailedStatsFreeHit[],
  team: ShotTeam,
  period: number | null
): DetailedStatsFreeHit[] {
  return freeHits.filter(
    (freeHit) =>
      freeHit.team === team && (period === null || freeHit.period === period)
  );
}

export type FreeHitZone = 'own_half' | 'opponent_half' | 'near_goal_area';

export const FREE_HIT_ZONES: readonly FreeHitZone[] = [
  'own_half',
  'opponent_half',
  'near_goal_area',
];

/**
 * Abstand zum gegnerischen Torraum, bis zu dem ein Freischlag als „Nähe
 * Torraum“ zählt. Die Regeln legen einen Freischlag näher als 3,5 m am
 * Torraum auf 3,5 m zurück; mit 1,5 m Spielraum für die Tippstelle fallen
 * diese Standards sicher hinein.
 */
export const NEAR_GOAL_AREA_M = 5;

/**
 * Zone eines Freischlags, aus Sicht des ausführenden Teams. Die Position ist
 * auf dessen Angriffsrichtung normiert (x = 1 gegnerische Bande), gerechnet
 * wird in Metern des jeweiligen Feldes, damit „Nähe Torraum“ auf Groß- und
 * Kleinfeld dieselben Meter bedeutet. Die Mittellinie zählt zur gegnerischen
 * Hälfte.
 */
export function freeHitZone(
  freeHit: Pick<DetailedStatsFreeHit, 'x' | 'y'>,
  field: FieldGeometry = FIELD_GEOMETRY.GF
): FreeHitZone {
  const x = clamp(freeHit.x, 0, 1) * field.length;
  const y = clamp(freeHit.y, 0, 1) * field.width;
  if (x < field.length / 2) return 'own_half';

  // Gegnerischer Torraum als Rechteck, Abstand zum nächsten Punkt darauf.
  const areaFront = field.length - field.goalAreaBack - field.goalAreaDepth;
  const areaBack = field.length - field.goalAreaBack;
  const areaTop = (field.width - field.goalAreaWidth) / 2;
  const areaBottom = areaTop + field.goalAreaWidth;
  const dx = Math.max(areaFront - x, 0, x - areaBack);
  const dy = Math.max(areaTop - y, 0, y - areaBottom);

  return Math.hypot(dx, dy) <= NEAR_GOAL_AREA_M
    ? 'near_goal_area'
    : 'opponent_half';
}

/** Anzahl Freischläge je Zone. */
export function freeHitZoneCounts(
  freeHits: DetailedStatsFreeHit[],
  field: FieldGeometry = FIELD_GEOMETRY.GF
): Record<FreeHitZone, number> {
  const counts: Record<FreeHitZone, number> = {
    own_half: 0,
    opponent_half: 0,
    near_goal_area: 0,
  };
  freeHits.forEach((freeHit) => counts[freeHitZone(freeHit, field)]++);
  return counts;
}

/**
 * Alle Abschnitte, in denen etwas erfasst wurde, aufsteigend. Quelle sind die
 * Schüsse, die Freischläge und die Abschnittswerte beider Teams, denn ein
 * Abschnitt kann für ein Team leer sein und für das andere nicht.
 */
export function periodsOf(stats: DetailedStats): number[] {
  const periods = new Set<number>();
  stats.shots.forEach((shot) => periods.add(shot.period));
  (stats.free_hits ?? []).forEach((freeHit) => periods.add(freeHit.period));
  (['home', 'guest'] as const).forEach((team) =>
    Object.keys(stats.teams?.[team]?.by_period ?? {}).forEach((key) => {
      const period = parseInt(key, 10);
      if (!isNaN(period)) periods.add(period);
    })
  );
  return [...periods].sort((a, b) => a - b);
}

/**
 * Torarten ohne Schuss im Spielfluss: Ein Eigentor schießt niemand aufs
 * gegnerische Tor, ein technisches Tor wird zugesprochen, und das
 * Penaltyschießen erfasst das Tablet nicht. Ein Abschnitt, der nur solche
 * Tore hat, ist also nicht unerfasst.
 */
const GOAL_TYPES_WITHOUT_SHOT = ['owngoal', 'technical', 'penalty_shots'];

export interface UncapturedPeriods {
  periods: number[];
  /** Tore aus diesen Abschnitten, die in Schuss- und Torhüterwerten fehlen. */
  goals: number;
}

/**
 * Abschnitte mit Toren laut Spielbericht, aber ohne einen einzigen erfassten
 * Schuss (fe#623). Typisch: Die Tablet-Erfassung begann erst im 2. Drittel,
 * dann fehlen die Tore des 1. Drittels in Teamsummen und Fangquoten, und die
 * Statistik passt scheinbar nicht zum Ergebnis. Abschnitte ohne Tor bleiben
 * außen vor, dort fehlt kein Tor. `null`, wenn nichts fehlt.
 */
export function uncapturedPeriods(
  events: GameEvent[] | null | undefined,
  stats: DetailedStats
): UncapturedPeriods | null {
  const captured = new Set(stats.shots.map((shot) => shot.period));
  const goals = (events ?? []).filter(
    (event) =>
      event.event_type === 'goal' &&
      !GOAL_TYPES_WITHOUT_SHOT.includes(event.goal_type ?? '') &&
      !captured.has(event.period)
  );
  if (!goals.length) return null;
  const periods = [...new Set(goals.map((event) => event.period))].sort(
    (a, b) => a - b
  );
  return { periods, goals: goals.length };
}

export const EMPTY_TEAM_STATS: TeamShotStats = {
  shots: 0,
  on_goal: 0,
  goals: 0,
  blocked: 0,
  missed: 0,
};

/** Werte eines Teams für einen Abschnitt oder (`null`) das ganze Spiel. */
export function teamStatsFor(
  stats: DetailedStats,
  team: ShotTeam,
  period: number | null
): TeamShotStats {
  const teamStats = stats.teams?.[team];
  if (!teamStats) return EMPTY_TEAM_STATS;
  if (period === null) return teamStats;
  return teamStats.by_period?.[String(period)] ?? EMPTY_TEAM_STATS;
}

/**
 * Fangquote in Prozent, eine Nachkommastelle. Selbst aus Paraden und
 * Schüssen aufs Tor gerechnet statt aus `save_pct`, damit die Anzeige nicht
 * davon abhängt, ob die API einen Anteil (0..1) oder Prozent liefert.
 * `null`, wenn kein Schuss aufs Tor kam.
 */
export function savePercentage(goalkeeper: GoalkeeperSaveStats): number | null {
  if (!goalkeeper.shots_against) return null;
  return Math.round((goalkeeper.saves / goalkeeper.shots_against) * 1000) / 10;
}

/**
 * Paraden eines Torhüters in einem Abschnitt (Feedback #62). `null`, wenn die
 * API keine Aufteilung liefert (ältere Stände) oder der Abschnitt fehlt.
 */
export function goalkeeperPeriodStats(
  goalkeeper: GoalkeeperStats,
  period: number
): GoalkeeperSaveStats | null {
  return goalkeeper.by_period?.[String(period)] ?? null;
}

/**
 * Gibt es Strafschüsse oder Tore mit herausgenommenem Torhüter (Feedback #61,
 * #63, #64)? Nur dann zeigt die Statistik den Abschnitt dafür.
 */
export function hasSpecialSituations(stats: DetailedStats): boolean {
  return (['home', 'guest'] as const).some((team) => {
    const teamStats = stats.teams?.[team];
    return (
      !!teamStats?.penalty_shots ||
      !!teamStats?.goals_empty_net ||
      !!teamStats?.goals_extra_attacker
    );
  });
}

/** Spieler mit den meisten Schüssen zuerst, bei Gleichstand mehr Tore. */
export function sortPlayers(players: PlayerShotStats[]): PlayerShotStats[] {
  return [...players].sort(
    (a, b) =>
      b.shots - a.shots ||
      b.goals - a.goals ||
      (a.trikot_number ?? 999) - (b.trikot_number ?? 999)
  );
}
