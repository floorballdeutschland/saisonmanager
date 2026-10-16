import {
  DetailedStats,
  DetailedStatsShot,
  GoalkeeperStats,
  PlayerShotStats,
  ShotResult,
  ShotTeam,
  TeamShotStats,
} from '@floorball/types';

/**
 * Spielfeld in Metern (Großfeld, 40 × 20 m). Die Schussgrafik zeichnet in
 * diesen Einheiten, damit die Linien maßstabsgetreu bleiben.
 */
export const RINK = {
  length: 40,
  width: 20,
  /** Abstand der Torlinie von der Bande. */
  goalLine: 3.5,
} as const;

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
 * Normierung laut API: x = 0 eigene Torlinie, x = 1 gegnerische Torlinie,
 * y = 0 links und y = 1 rechts aus Sicht des Angreifers. Für Heim (Blick nach
 * rechts) liegt „links“ oben. Der Gast blickt nach links, für ihn liegt „links“
 * unten. Sein Schuss wird deshalb um den Mittelpunkt gedreht, also x UND y
 * gespiegelt. Spiegelte man nur x, landete ein Schuss von der linken Seite des
 * Gastes auf seiner rechten.
 *
 * Werte knapp außerhalb von 0..1 (hinter dem Tor) bleiben erhalten, nur über
 * die Bande hinaus wird abgeschnitten.
 */
export function toFieldPoint(
  shot: Pick<DetailedStatsShot, 'team' | 'x' | 'y'>
): FieldPoint {
  const span = RINK.length - 2 * RINK.goalLine;
  const x = shot.team === 'home' ? shot.x : 1 - shot.x;
  const y = shot.team === 'home' ? shot.y : 1 - shot.y;

  return {
    cx: clamp(RINK.goalLine + x * span, 0, RINK.length),
    cy: clamp(y * RINK.width, 0, RINK.width),
  };
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

/**
 * Alle Abschnitte, in denen etwas erfasst wurde, aufsteigend. Quelle sind die
 * Schüsse und die Abschnittswerte beider Teams, denn ein Abschnitt kann für
 * ein Team leer sein und für das andere nicht.
 */
export function periodsOf(stats: DetailedStats): number[] {
  const periods = new Set<number>();
  stats.shots.forEach((shot) => periods.add(shot.period));
  (['home', 'guest'] as const).forEach((team) =>
    Object.keys(stats.teams?.[team]?.by_period ?? {}).forEach((key) => {
      const period = parseInt(key, 10);
      if (!isNaN(period)) periods.add(period);
    })
  );
  return [...periods].sort((a, b) => a - b);
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
export function savePercentage(goalkeeper: GoalkeeperStats): number | null {
  if (!goalkeeper.shots_against) return null;
  return Math.round((goalkeeper.saves / goalkeeper.shots_against) * 1000) / 10;
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
