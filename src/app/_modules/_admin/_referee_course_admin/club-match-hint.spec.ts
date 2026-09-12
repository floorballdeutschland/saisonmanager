import { RefereeCourseResult } from '@floorball/types';
import { clubMatchHintKey, csvClubUnmatched } from './club-match-hint';
import de from 'src/assets/i18n/admin/referee-course/de.json';
import en from 'src/assets/i18n/admin/referee-course/en.json';

// Der Vereinsabgleich der API löst in einer festen Reihenfolge auf
// (RefereeClubLookup): Namensliste, exakter Vereinsname, exakter Langname,
// dann beide ohne „e.V." und Satzzeichen. Alles außer dem exakten
// Vereinsnamen ist eine Schlussfolgerung — und genau die soll die Maske
// benennen, statt sie wie Gleichheit aussehen zu lassen.
//
// Geprüft wird gegen die echten Sprachdateien: Gegen im Test selbst gesetzte
// Strings wäre es tautologisch, und ein Schlüssel, der nur in einer der
// beiden Dateien fehlt, rendert in der Maske sichtbar seinen eigenen Namen.

function zeile(overrides: Partial<RefereeCourseResult> = {}) {
  return {
    csv: { verein: 'Unihockeyverein Zwigge 07 e.V.' },
    ...overrides,
  } as RefereeCourseResult;
}

const CLUB = { id: 143, name: 'UV Zwigge 07', state_association_id: 3 };

function resolve(key: string, dict: Record<string, unknown>): unknown {
  return key
    .replace('refereeCourseAdmin.', '')
    .split('.')
    .reduce<unknown>(
      (acc, part) => (acc as Record<string, unknown>)?.[part],
      dict
    );
}

describe('clubMatchHintKey', () => {
  it('nennt den Treffer über den Langnamen', () => {
    expect(
      clubMatchHintKey(
        zeile({ csv_club_match: { ...CLUB, match_type: 'long_name' } })
      )
    ).toBe('refereeCourseAdmin.detail.clubMatchLongName');
  });

  it('nennt den Treffer über die Namensliste', () => {
    expect(
      clubMatchHintKey(
        zeile({ csv_club_match: { ...CLUB, match_type: 'alias' } })
      )
    ).toBe('refereeCourseAdmin.detail.clubMatchAlias');
  });

  // Beide normalisierten Wege bekommen denselben Text: Für den Leser der Maske
  // ist der Unterschied zwischen „Name bereinigt" und „Langname bereinigt"
  // keine Information, die Aussage ist „nicht wortgleich".
  it('fasst die bereinigten Schreibweisen zusammen', () => {
    const ueberName = clubMatchHintKey(
      zeile({ csv_club_match: { ...CLUB, match_type: 'normalized_name' } })
    );
    const ueberLangname = clubMatchHintKey(
      zeile({ csv_club_match: { ...CLUB, match_type: 'normalized_long_name' } })
    );

    expect(ueberName).toBe('refereeCourseAdmin.detail.clubMatchNormalized');
    expect(ueberLangname).toBe(ueberName);
  });

  it('sagt zum exakten Vereinsnamen nichts', () => {
    expect(
      clubMatchHintKey(
        zeile({ csv_club_match: { ...CLUB, match_type: 'name' } })
      )
    ).toBeNull();
  });

  // Die Herkunft ohne Treffer: „mehrdeutig" ist die einzige, die eine Aufgabe
  // benennt (Eintrag in die Namensliste). „unbekannt" erklärt schon die rote
  // Meldung daneben.
  it('nennt eine mehrdeutige Schreibweise', () => {
    expect(
      clubMatchHintKey(
        zeile({ csv_club_match: null, csv_club_match_type: 'ambiguous' })
      )
    ).toBe('refereeCourseAdmin.detail.clubMatchAmbiguous');
  });

  it('sagt zu einem unbekannten Namen nichts zusätzlich', () => {
    expect(
      clubMatchHintKey(
        zeile({ csv_club_match: null, csv_club_match_type: 'none' })
      )
    ).toBeNull();
  });

  it('sagt ohne jede Angabe nichts', () => {
    expect(clubMatchHintKey(zeile({ csv_club_match: null }))).toBeNull();
    expect(clubMatchHintKey(zeile())).toBeNull();
  });

  // Neue API, altes Frontend: Ein unbekannter Wert ist eher „nicht wortgleich"
  // als „exakt" — Schweigen wäre hier das Gegenteil der Absicht.
  it('fällt bei einem unbekannten Wert auf einen allgemeinen Hinweis zurück', () => {
    expect(
      clubMatchHintKey(
        zeile({
          csv_club_match: {
            ...CLUB,
            match_type: 'short_name' as never,
          },
        })
      )
    ).toBe('refereeCourseAdmin.detail.clubMatchOther');
  });

  it('hat für jeden Hinweis einen Text in beiden Sprachen', () => {
    const keys = [
      'refereeCourseAdmin.detail.clubMatchAlias',
      'refereeCourseAdmin.detail.clubMatchLongName',
      'refereeCourseAdmin.detail.clubMatchNormalized',
      'refereeCourseAdmin.detail.clubMatchAmbiguous',
      'refereeCourseAdmin.detail.clubMatchAliasBroken',
      'refereeCourseAdmin.detail.clubMatchOther',
    ];

    keys.forEach((key) => {
      expect(resolve(key, de as Record<string, unknown>))
        .withContext(`de: ${key}`)
        .toBeTruthy();
      expect(resolve(key, en as Record<string, unknown>))
        .withContext(`en: ${key}`)
        .toBeTruthy();
    });
  });
});

describe('csvClubUnmatched', () => {
  it('meldet einen Namen ohne Treffer', () => {
    expect(csvClubUnmatched(zeile({ csv_club_match: null }))).toBeTrue();
  });

  it('meldet nichts bei einem Treffer', () => {
    expect(csvClubUnmatched(zeile({ csv_club_match: CLUB }))).toBeFalse();
  });

  // Der Fall, der ohne `=== null` in jeder Zeile mit Vereinsfeld die rote
  // Meldung erzeugt hätte: Frontend deployt, API noch nicht — das Feld fehlt
  // in der Antwort, und ein fehlendes Feld ist keine Aussage.
  it('meldet nichts, wenn die API das Feld nicht liefert', () => {
    expect(csvClubUnmatched(zeile())).toBeFalse();
  });

  it('meldet nichts, wenn die Datei keinen Verein nennt', () => {
    expect(
      csvClubUnmatched(
        zeile({ csv: { verein: null }, csv_club_match: null } as never)
      )
    ).toBeFalse();
  });
});
