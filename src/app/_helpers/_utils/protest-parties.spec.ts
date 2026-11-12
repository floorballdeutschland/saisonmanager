import { GameAdditionalFields } from '@floorball/types';
import { protestPartiesMissing } from './protest-parties';

function fields(partial: Partial<GameAdditionalFields>): GameAdditionalFields {
  return partial as GameAdditionalFields;
}

describe('protestPartiesMissing', () => {
  const options = [{ key: 'guest' as const, label: 'Gastteam' }];

  it('meldet einen Protest ohne gewählte Partei', () => {
    expect(
      protestPartiesMissing(
        fields({
          protest: true,
          protest_parties: [],
          protest_party_options: options,
        })
      )
    ).toBeTrue();
  });

  it('ist mit einer Partei oder ohne Protest erfüllt', () => {
    expect(
      protestPartiesMissing(
        fields({
          protest: true,
          protest_parties: ['other'],
          protest_party_options: options,
        })
      )
    ).toBeFalse();
    expect(
      protestPartiesMissing(
        fields({ protest: false, protest_party_options: options })
      )
    ).toBeFalse();
  });

  // Eine API ohne die Auswahl liefert keine Optionen; dann sperrt die Maske nichts.
  it('sperrt nichts bei einer älteren API', () => {
    expect(protestPartiesMissing(fields({ protest: true }))).toBeFalse();
    expect(protestPartiesMissing(undefined)).toBeFalse();
  });
});
