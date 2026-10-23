import { GameEvent } from '@floorball/types';

export interface GoalCandidate {
  period: number;
  time: string;
  team: string;
}

interface GoalEntry extends GoalCandidate {
  id: number;
}

// Dieselbe Reihenfolge wie Game.event_sort_key in der API: Abschnitt, Zeit
// (links mit Nullen auf fünf Zeichen, also "9:13" → "09:13"), dann id.
function compareGoals(a: GoalEntry, b: GoalEntry): number {
  if (a.period !== b.period) {
    return a.period - b.period;
  }
  const timeA = a.time.padStart(5, '0');
  const timeB = b.time.padStart(5, '0');
  if (timeA !== timeB) {
    return timeA < timeB ? -1 : 1;
  }
  return a.id - b.id;
}

function scoreHistory(goals: GoalEntry[]): Map<number, string> {
  let home = 0;
  let guest = 0;
  const history = new Map<number, string>();
  [...goals].sort(compareGoals).forEach((goal) => {
    if (goal.team === 'home') {
      home++;
    } else {
      guest++;
    }
    history.set(goal.id, `${home}:${guest}`);
  });
  return history;
}

/**
 * Zählt die bereits erfassten Tore, deren Spielstand sich ändert, wenn das Tor
 * `candidate` eingetragen wird (oder, mit `editedEventId`, das bestehende Tor
 * so geändert wird). Der Stand des bearbeiteten Tors selbst zählt nicht.
 *
 * Gegenstück zur Prüfung in der API (`confirm_score_change`, api#835): Ein Tor,
 * das vor erfasste Tore rutscht, ist oft ein Tippfehler in der Zeit. In Spiel
 * 58665 wurde 9:13 als 3:13 erfasst, und aus einem 1:0 wurde still ein 0:1.
 */
export function countRewrittenGoalScores(
  events: GameEvent[],
  candidate: GoalCandidate,
  editedEventId?: number
): number {
  const stored = events.filter((e) => e.event_type !== 'timeout');
  const goals: GoalEntry[] = stored
    .filter((e) => e.event_type === 'goal')
    .map((e) => ({
      id: e.event_id,
      period: Number(e.period),
      time: String(e.time),
      team: e.event_team,
    }));

  const candidateId =
    editedEventId ?? Math.max(0, ...stored.map((e) => e.event_id)) + 1;
  const before = scoreHistory(goals);
  const after = scoreHistory([
    ...goals.filter((g) => g.id !== candidateId),
    { ...candidate, id: candidateId },
  ]);

  let changed = 0;
  before.forEach((score, id) => {
    if (id !== candidateId && after.get(id) !== score) {
      changed++;
    }
  });
  return changed;
}
