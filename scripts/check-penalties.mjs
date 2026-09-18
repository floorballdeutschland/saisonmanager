/**
 * Prüft die Strafenrechnung der Livestream-Overlays (`overlay/penalties.js`).
 *
 * Diese Datei rechnet aus, welche Strafen gerade laufen und wie lange noch --
 * aus den Ereignissen des Spielberichts und der von Hand gestellten Uhr des
 * Bedienfelds. Sie steht damit an derselben Stelle wie eine Strafuhr in der
 * Halle: Was hier falsch herauskommt, steht auf Sendung, und niemand sieht der
 * Anzeige an, dass sie falsch ist.
 *
 * `overlay/` liegt außerhalb des Angular-Builds, Karma liefert es nicht aus,
 * und `ng lint` sieht es nicht (siehe `npm run check:overlay`). Deshalb hier
 * als eigenständiges Skript ohne Testrahmen -- `node scripts/check-penalties.mjs`
 * läuft überall, wo `node` läuft.
 *
 * Geprüft wird ausdrücklich die REGEL, nicht nur die Arithmetik: Eine kleine
 * Strafe endet beim Überzahltor, eine doppelte nur zur Hälfte, eine große gar
 * nicht -- und persönliche Strafen und Matchstrafen gehören überhaupt nicht auf
 * die Anzeigetafel.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = require(join(root, 'overlay/penalties.js'));

let fehler = 0;

function pruef(name, ist, soll) {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) {
    fehler += 1;
    console.error(`FEHL ${name}`);
    console.error(`     ist:  ${JSON.stringify(ist)}`);
    console.error(`     soll: ${JSON.stringify(soll)}`);
  }
}

const spiel = (events, period = 1) => ({
  current_period_title: { period, title: '1. Drittel', running: true },
  events,
});

const strafe = (o) => ({
  event_id: o.id,
  event_type: 'penalty',
  event_team: o.side || 'home',
  period: o.period ?? 1,
  time: o.time,
  number: o.number ?? 17,
  scorer_name: o.name ?? 'M. Muster',
  penalty_type: o.type || 'penalty_2',
});

const tor = (o) => ({
  event_id: o.id,
  event_type: 'goal',
  event_team: o.side,
  period: o.period ?? 1,
  time: o.time,
  number: 9,
});

const min = (m, s = 0) => (m * 60 + s) * 1000;
const rest = (liste) => liste.map((e) => e.remaining_ms);
const ids = (liste) => liste.map((e) => e.event_id);

// ── Grundfall ───────────────────────────────────────────────────────────────

pruef(
  '2 Minuten ab 5:00, Uhr bei 6:00',
  rest(P.laufende(spiel([strafe({ id: 1, time: '5:00' })]), {}, min(6))),
  [min(1)]
);

pruef(
  'abgelaufene Strafe fällt raus',
  P.laufende(spiel([strafe({ id: 1, time: '5:00' })]), {}, min(7, 1)),
  []
);

pruef(
  'der Eintrag trägt Seite, Nummer und Namen',
  P.laufende(spiel([strafe({ id: 1, time: '5:00' })]), {}, min(6)),
  [
    {
      event_id: 1,
      side: 'home',
      number: 17,
      name: 'M. Muster',
      penalty_type: 'penalty_2',
      remaining_ms: min(1),
    },
  ]
);

// ── Ohne Bezugsgröße lieber nichts ──────────────────────────────────────────

pruef(
  'ohne Uhr keine Strafen',
  P.laufende(spiel([strafe({ id: 1, time: '5:00' })]), {}, null),
  []
);

pruef(
  'in der Drittelpause keine Strafen',
  P.laufende(spiel([strafe({ id: 1, time: '5:00' })], 1.5), {}, min(6)),
  []
);

pruef(
  'Strafe aus einem früheren Abschnitt läuft nicht weiter',
  P.laufende(spiel([strafe({ id: 1, time: '5:00', period: 1 })], 2), {}, min(6)),
  []
);

pruef(
  'unlesbare Ereigniszeit wird übersprungen',
  P.laufende(spiel([strafe({ id: 1, time: 'kurz nach halb' })]), {}, min(6)),
  []
);

// ── Überzahltor ─────────────────────────────────────────────────────────────

pruef(
  'Gegentor während der Strafe beendet sie',
  P.laufende(
    spiel([
      strafe({ id: 1, time: '5:00' }),
      tor({ id: 2, side: 'guest', time: '5:30' }),
    ]),
    {},
    min(6)
  ),
  []
);

pruef(
  'ein eigenes Tor beendet sie nicht',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00' }),
        tor({ id: 2, side: 'home', time: '5:30' }),
      ]),
      {},
      min(6)
    )
  ),
  [min(1)]
);

pruef(
  'ein Tor VOR der Strafe geht sie nichts an',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00' }),
        tor({ id: 2, side: 'guest', time: '4:30' }),
      ]),
      {},
      min(6)
    )
  ),
  [min(1)]
);

pruef(
  'ein Tor NACH dem Ablauf geht sie nichts an',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00' }),
        tor({ id: 2, side: 'guest', time: '7:30' }),
      ]),
      {},
      min(6)
    )
  ),
  [min(1)]
);

// ── Doppelte kleine Strafe ──────────────────────────────────────────────────

pruef(
  '2+2 ab 5:00, Uhr bei 6:00',
  rest(
    P.laufende(
      spiel([strafe({ id: 1, time: '5:00', type: 'penalty_2and2' })]),
      {},
      min(6)
    )
  ),
  [min(3)]
);

// Das Tor beendet die erste Haelfte IN DIESEM AUGENBLICK, die zweite laeuft von
// dort zwei Minuten: 5:00 + Tor um 5:30 endet um 7:30. Ein pauschaler Abzug von
// zwei Minuten haette 7:00 ergeben und den Eintrag eine halbe Minute zu frueh
// von der Tafel geraeumt.
pruef(
  '2+2: ein Gegentor beendet die erste Haelfte, die zweite laeuft ab dem Tor',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00', type: 'penalty_2and2' }),
        tor({ id: 2, side: 'guest', time: '5:30' }),
      ]),
      {},
      min(6)
    )
  ),
  [min(1, 30)]
);

pruef(
  '2+2: kurz vor dem Ende der zweiten Haelfte',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00', type: 'penalty_2and2' }),
        tor({ id: 2, side: 'guest', time: '5:45' }),
      ]),
      {},
      min(7, 15)
    )
  ),
  [min(0, 30)]
);

pruef(
  '2+2: zwei Gegentore beenden sie',
  P.laufende(
    spiel([
      strafe({ id: 1, time: '5:00', type: 'penalty_2and2' }),
      tor({ id: 2, side: 'guest', time: '5:30' }),
      tor({ id: 3, side: 'guest', time: '6:30' }),
    ]),
    {},
    min(6, 45)
  ),
  []
);

// ── Arten, die nicht auf die Anzeigetafel gehören ───────────────────────────

pruef(
  'persönliche Strafe (10 Minuten) läuft mit',
  rest(
    P.laufende(
      spiel([strafe({ id: 1, time: '5:00', type: 'penalty_10' })]),
      {},
      min(6)
    )
  ),
  [min(9)]
);

pruef(
  'die zehn Minuten kürzt ein Überzahltor nicht',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00', type: 'penalty_10' }),
        tor({ id: 2, side: 'guest', time: '5:30' }),
      ]),
      {},
      min(6)
    )
  ),
  [min(9)]
);

// Der Regelfall: zehn Minuten kommen nie allein. Das Überzahltor beendet die
// begleitende Zeitstrafe, die persönliche läuft weiter -- und genau so steht es
// dann auch auf der Tafel.
pruef(
  'begleitende Zeitstrafe endet, die persönliche läuft weiter',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00', type: 'penalty_10' }),
        strafe({ id: 2, time: '5:00', type: 'penalty_2' }),
        tor({ id: 3, side: 'guest', time: '5:30' }),
      ]),
      {},
      min(6)
    )
  ),
  [min(9)]
);

pruef(
  'ohne Überzahltor stehen beide nebeneinander, die kürzere zuerst',
  ids(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00', type: 'penalty_10' }),
        strafe({ id: 2, time: '5:00', type: 'penalty_2' }),
      ]),
      {},
      min(6)
    )
  ),
  [2, 1]
);

pruef(
  'Matchstrafe nicht dabei',
  P.laufende(
    spiel([strafe({ id: 1, time: '5:00', type: 'penalty_ms_full' })]),
    {},
    min(6)
  ),
  []
);

pruef(
  'große Strafe (Altbestand) läuft mit',
  rest(
    P.laufende(
      spiel([strafe({ id: 1, time: '5:00', type: 'penalty_5' })]),
      {},
      min(6)
    )
  ),
  [min(4)]
);

pruef(
  'große Strafe läuft trotz Gegentor voll ab',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00', type: 'penalty_5' }),
        tor({ id: 2, side: 'guest', time: '5:30' }),
      ]),
      {},
      min(6)
    )
  ),
  [min(4)]
);

// ── Eingriff der Regie ──────────────────────────────────────────────────────

pruef(
  'von Hand beendet schlägt die Rechnung',
  P.laufende(
    spiel([strafe({ id: 1, time: '5:00' })]),
    { penalties_ended: [1] },
    min(6)
  ),
  []
);

pruef(
  'von Hand beendet auch bei gemischten Kennungstypen',
  P.laufende(
    spiel([strafe({ id: '1', time: '5:00' })]),
    { penalties_ended: [1] },
    min(6)
  ),
  []
);

// ── Randfälle der Anzeige ───────────────────────────────────────────────────

pruef(
  'Uhr hängt hinter dem Sekretariat: auf die Dauer gedeckelt',
  rest(P.laufende(spiel([strafe({ id: 1, time: '5:00' })]), {}, min(4))),
  [min(2)]
);

pruef(
  'vorderste zuerst, höchstens drei je Mannschaft',
  ids(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00' }),
        strafe({ id: 2, time: '5:30', number: 8 }),
        strafe({ id: 3, time: '5:40', number: 9 }),
        strafe({ id: 4, time: '5:50', number: 10 }),
        strafe({ id: 5, time: '5:10', side: 'guest', number: 4 }),
      ]),
      {},
      min(5, 55)
    )
  ),
  [1, 5, 2, 3]
);

pruef(
  'Restzeit wird aufgerundet',
  [P.restText(1400), P.restText(61000), P.restText(0), P.restText(600000)],
  ['0:02', '1:01', '0:00', '10:00']
);

// ── Unterzahl: nur ein Ueberzahltor beendet eine Strafe ─────────────────────

// Vier gegen vier. Das Gasttor faellt bei gleicher Staerke und beendet die
// Heimstrafe deshalb NICHT. Vorher verschwand sie von der Tafel, obwohl der
// Spieler weiter auf der Strafbank sass.
pruef(
  'bei vier gegen vier beendet ein Tor keine Strafe',
  rest(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00', side: 'home' }),
        strafe({ id: 2, time: '5:05', side: 'guest' }),
        tor({ id: 3, side: 'guest', time: '5:30' }),
      ]),
      {},
      min(6)
    )
  ),
  [min(1), min(1, 5)]
);

// Drei gegen fuenf: Das Tor beendet genau eine Strafe, naemlich die, die als
// naechste ablaeuft. Die zweite bleibt stehen.
pruef(
  'bei drei gegen fuenf beendet das Tor nur die vordere Strafe',
  ids(
    P.laufende(
      spiel([
        strafe({ id: 1, time: '5:00', side: 'home' }),
        strafe({ id: 2, time: '5:30', side: 'home', number: 8 }),
        tor({ id: 3, side: 'guest', time: '5:40' }),
      ]),
      {},
      min(6)
    )
  ),
  [2]
);

// Nach Ablauf der ersten Strafe ist die Mannschaft wieder in Unterzahl von
// einem Spieler -- ein Tor beendet dann auch die zweite.
pruef(
  'danach beendet das naechste Tor die zweite Strafe',
  P.laufende(
    spiel([
      strafe({ id: 1, time: '5:00', side: 'home' }),
      strafe({ id: 2, time: '5:30', side: 'home', number: 8 }),
      tor({ id: 3, side: 'guest', time: '5:40' }),
      tor({ id: 4, side: 'guest', time: '6:10' }),
    ]),
    {},
    min(6, 30)
  ),
  []
);

// ── Abschnittsnummer als Zeichenkette ──────────────────────────────────────
//
// `events` ist eine JSONB-Spalte, der Spielbericht schreibt die Nummer
// ungeprueft. Steht sie als Zeichenkette, darf weder die Strafe verschwinden
// noch die Verkuerzung ausfallen.

pruef(
  'Strafe mit Abschnitt als Zeichenkette laeuft mit',
  rest(
    P.laufende(spiel([strafe({ id: 1, time: '5:00', period: '1' })]), {}, min(6))
  ),
  [min(1)]
);

pruef(
  'Ueberzahltor mit Abschnitt als Zeichenkette beendet die Strafe',
  P.laufende(
    spiel([
      strafe({ id: 1, time: '5:00' }),
      tor({ id: 2, side: 'guest', time: '5:30', period: '1' }),
    ]),
    {},
    min(6)
  ),
  []
);

// ── Uhr weit hinter dem Sekretariat ────────────────────────────────────────

pruef(
  'eine Minute Uhrversatz zeigt die volle Dauer',
  rest(P.laufende(spiel([strafe({ id: 1, time: '5:00' })]), {}, min(4))),
  [min(2)]
);

// Nach einem Zuruecksetzen steht die Uhr auf 0:00. Ohne Grenze tauchten alle
// Strafen des Abschnitts wieder mit voller Dauer auf.
pruef(
  'auf 0:00 zurueckgesetzte Uhr zeigt keine Strafen',
  P.laufende(spiel([strafe({ id: 1, time: '5:00' })]), {}, 0),
  []
);

if (fehler > 0) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen.`);
  process.exit(1);
}

console.log('Strafenrechnung der Overlays: alles in Ordnung.');
