import { isKnockout } from './league-type';

describe('isKnockout', () => {
  it('erkennt Pokal und Playoffs als Ausscheidungswettbewerb', () => {
    expect(isKnockout({ league_type: 'cup' })).toBe(true);
    expect(isKnockout({ league_type: 'playoff' })).toBe(true);
  });

  it('Liga und Meisterschaft laufen nicht im K.-o.-System', () => {
    expect(isKnockout({ league_type: 'league' })).toBe(false);
    expect(isKnockout({ league_type: 'champ' })).toBe(false);
  });

  it('ohne Angabe keine Annahme', () => {
    // Altligen ohne Modus und ein fehlendes Feld dürfen die Tabelle nicht
    // verlieren: Ohne Auskunft ist die Liga eine Liga.
    expect(isKnockout(null)).toBe(false);
    expect(isKnockout(undefined)).toBe(false);
    expect(isKnockout({})).toBe(false);
    expect(isKnockout({ league_type: null })).toBe(false);
  });
});
