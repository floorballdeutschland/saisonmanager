import { RefereeCourseResult } from '@floorball/types';
import { clubMatchHintKey } from './club-match-hint';

// Der Vereinsabgleich der API löst in einer festen Reihenfolge auf
// (RefereeClubLookup): Namensliste, exakter Vereinsname, exakter Langname,
// dann beide ohne „e.V." und Satzzeichen. Alles außer dem exakten
// Vereinsnamen ist eine Schlussfolgerung — und genau die soll die Maske
// benennen, statt sie wie Gleichheit aussehen zu lassen.

function zeile(csvClubMatch: RefereeCourseResult['csv_club_match']) {
  return { csv_club_match: csvClubMatch } as RefereeCourseResult;
}

const CLUB = { id: 143, name: 'UV Zwigge 07', state_association_id: 3 };

describe('clubMatchHintKey', () => {
  it('nennt den Treffer über den Langnamen', () => {
    expect(clubMatchHintKey(zeile({ ...CLUB, match_type: 'long_name' }))).toBe(
      'refereeCourseAdmin.detail.clubMatchLongName'
    );
  });

  it('nennt den Treffer über die Namensliste', () => {
    expect(clubMatchHintKey(zeile({ ...CLUB, match_type: 'alias' }))).toBe(
      'refereeCourseAdmin.detail.clubMatchAlias'
    );
  });

  // Beide normalisierten Wege bekommen denselben Text: Für den Leser der Maske
  // ist der Unterschied zwischen „Name bereinigt" und „Langname bereinigt"
  // keine Information, die Aussage ist „nicht wortgleich".
  it('fasst die bereinigten Schreibweisen zusammen', () => {
    const ueberName = clubMatchHintKey(
      zeile({ ...CLUB, match_type: 'normalized_name' })
    );
    const ueberLangname = clubMatchHintKey(
      zeile({ ...CLUB, match_type: 'normalized_long_name' })
    );

    expect(ueberName).toBe('refereeCourseAdmin.detail.clubMatchNormalized');
    expect(ueberLangname).toBe(ueberName);
  });

  // Ein exakter Treffer braucht keinen Hinweis. Stünde auch dort einer, wäre
  // der Hinweis wertlos: Er soll ja gerade die Ausnahme markieren.
  it('sagt zum exakten Vereinsnamen nichts', () => {
    expect(clubMatchHintKey(zeile({ ...CLUB, match_type: 'name' }))).toBeNull();
  });

  it('sagt ohne Treffer nichts', () => {
    expect(clubMatchHintKey(zeile(null))).toBeNull();
  });

  // Bestandszeilen und die Freigabe-Übersicht können das Feld ohne Herkunft
  // liefern (vor diesem Stand gespeicherte Antworten, andere Endpunkte).
  it('sagt ohne Herkunftsangabe nichts', () => {
    expect(clubMatchHintKey(zeile(CLUB))).toBeNull();
  });
});
