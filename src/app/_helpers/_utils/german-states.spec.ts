import {
  CLUB_STATE_OPTIONS,
  GERMAN_STATES,
  germanStateName,
} from './german-states';

describe('german-states', () => {
  it('fuehrt genau die 16 Bundeslaender', () => {
    // Vollstaendig festgenagelt und nicht per Stichprobe: dieselbe Liste steht
    // in der API als ApplicationRecord.german_states, und deren Test haelt sie
    // gegen dasselbe Literal. Laeuft eine Seite weg, weist die API ein hier
    // angebotenes Bundesland beim Speichern als unbekannt ab — mit einem 422
    // fuer den ganzen Datensatz, aus dem niemand auf ein Kuerzel schliesst.
    expect(GERMAN_STATES.map((s) => s.isocode).sort()).toEqual([
      'de-bb',
      'de-be',
      'de-bw',
      'de-by',
      'de-hb',
      'de-he',
      'de-hh',
      'de-mv',
      'de-ni',
      'de-nw',
      'de-rp',
      'de-sh',
      'de-sl',
      'de-sn',
      'de-st',
      'de-th',
    ]);
  });

  it('sortiert die Auswahl alphabetisch nach Name', () => {
    const names = GERMAN_STATES.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'de')));
  });

  it('kennt Sonstige nur beim Vereinssitz, nicht als Zustaendigkeitsbereich', () => {
    // de-sonstige gibt es fuer Vereine mit Sitz im Ausland. Ein Verband kann
    // dafuer nicht zustaendig sein, die API weist das Kuerzel dort ab.
    const clubCodes = CLUB_STATE_OPTIONS.map((s) => s.isocode);
    expect(clubCodes).toContain('de-sonstige');
    // Als string[] gelesen: GermanStateCode kennt das Kuerzel gar nicht, der
    // Vergleich waere sonst schon zur Uebersetzungszeit unzulaessig — was fuer
    // sich genommen die Zusicherung ist, hier aber pruefbar bleiben soll.
    const stateCodes: string[] = GERMAN_STATES.map((s) => s.isocode);
    expect(stateCodes).not.toContain('de-sonstige');
    expect(CLUB_STATE_OPTIONS.length).toBe(GERMAN_STATES.length + 1);
  });

  it('loest Kuerzel in Klartext auf und laesst Unbekanntes stehen', () => {
    expect(germanStateName('de-nw')).toBe('Nordrhein-Westfalen');
    expect(germanStateName('de-sonstige')).toBe('Sonstige');
    expect(germanStateName('de-xx')).toBe('de-xx');
  });
});
