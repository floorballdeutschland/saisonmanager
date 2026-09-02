import {
  competitionKey,
  competitionMarkUrl,
  competitionPalette,
  leagueMarkUrl,
} from './competition-theme';

// Diese Ableitung gibt es zweimal: hier und als `competitionKey` in
// `overlay/overlay.js`. Die Bühne liegt außerhalb von Karma, hat also keine
// Tests -- umso mehr müssen die Fälle hier stehen, denn sie beschreiben die
// Regel für beide Seiten.
describe('competitionKey', () => {
  it('erkennt einen Pokal am league_type, nicht am Namen', () => {
    expect(
      competitionKey({ league_type: 'cup', name: 'Floorball Deutschland Cup' })
    ).toBe('pokal');
  });

  // Auf Prod heißen mehrere Pokalwettbewerbe „Cup" oder „Trophy". Ohne diesen
  // Rückfall liefen sie im Bild der 1. Bundesliga.
  it('erkennt einen Pokal ohne league_type am Namen', () => {
    expect(competitionKey({ name: 'FD Trophy' })).toBe('pokal');
    expect(competitionKey({ name: 'Deutscher Pokal' })).toBe('pokal');
    expect(competitionKey({ name: 'Floorball Deutschland Cup' })).toBe('pokal');
  });

  // Ein gesetzter league_type sticht den Namen: Eine Liga, die zufällig „Cup"
  // heißt, ist deshalb kein Pokal.
  it('zieht den league_type dem Namen vor', () => {
    expect(
      competitionKey({
        league_type: 'league',
        league_class_id: '1fbl',
        name: 'Cup-Liga',
      })
    ).toBe('1fbl-m');
  });

  it('gibt einer Meisterschaft keine Bundesliga-Marke', () => {
    expect(competitionKey({ league_type: 'champ', female: false })).toBe(
      'neutral'
    );
    expect(competitionKey({ league_type: 'champ', female: true })).toBe(
      'damen'
    );
    expect(competitionMarkUrl('neutral')).toBeNull();
    expect(competitionMarkUrl('damen')).toBeNull();
  });

  it('unterscheidet die vier Bundesligen', () => {
    expect(competitionKey({ league_class_id: '1fbl', female: false })).toBe(
      '1fbl-m'
    );
    expect(competitionKey({ league_class_id: '1fbl', female: true })).toBe(
      '1fbl-w'
    );
    expect(competitionKey({ league_class_id: '2fbl', female: false })).toBe(
      '2fbl-m'
    );
    expect(competitionKey({ league_class_id: '2fbl', female: true })).toBe(
      '2fbl-w'
    );
  });

  it('fasst Regional-, Verbands- und Landesliga zusammen', () => {
    for (const leagueClass of ['rl', 'vl', 'll']) {
      expect(competitionKey({ league_class_id: leagueClass })).toBe('regional');
    }
  });

  // Beide Wege in den unbekannten Zustand gibt es im Bestand: eine leere Spalte
  // (die Validierung an League erlaubt blank) und ein Altwert wie „10", den die
  // API roh weitergibt. Eine Damen-Partie darf dabei nicht im Markenrot der
  // 1. Herren landen.
  it('fällt bei unbekannter Ligaklasse auf damen oder neutral zurück', () => {
    expect(competitionKey({ league_class_id: '', female: true })).toBe('damen');
    expect(competitionKey({ league_class_id: '10', female: true })).toBe(
      'damen'
    );
    expect(competitionKey({ league_class_id: '10', female: false })).toBe(
      'neutral'
    );
  });

  it('behauptet ohne Liga keinen Wettbewerb', () => {
    expect(competitionKey(null)).toBe('neutral');
    expect(competitionKey(undefined)).toBe('neutral');
  });
});

describe('competitionPalette', () => {
  it('gibt der 1. Herren und dem neutralen Bild dieselben Farben', () => {
    expect(competitionPalette('1fbl-m')).toEqual(competitionPalette('neutral'));
  });

  it('unterscheidet die Damen von der 1. Herren', () => {
    expect(competitionPalette('1fbl-w').accent).not.toBe(
      competitionPalette('1fbl-m').accent
    );
    expect(competitionPalette('damen')).toEqual(competitionPalette('1fbl-w'));
  });
});

describe('leagueMarkUrl', () => {
  it('zieht ein hochgeladenes Ligazeichen der mitgelieferten Marke vor', () => {
    expect(
      leagueMarkUrl({
        league_class_id: '1fbl',
        logo_url: '/api/storage/blobs/redirect/abc/logo.png',
        logo_source: 'league',
      })
    ).toBe('/api/storage/blobs/redirect/abc/logo.png');
  });

  // Der öffentliche Ligaabruf fällt auf das Logo des Landesverbands zurück. Im
  // Livestream stünde das für den falschen Zusammenhang.
  it('nimmt das Logo des Landesverbands nicht', () => {
    expect(
      leagueMarkUrl({
        league_class_id: '1fbl',
        logo_url: '/api/storage/blobs/redirect/abc/lv.png',
        logo_source: 'state_association',
      })
    ).toBe('/overlay/img/1-fbl-herren-weiss.png');
  });

  it('lässt einen nicht zuzuordnenden Wettbewerb ohne Zeichen', () => {
    expect(leagueMarkUrl({ league_type: 'champ' })).toBeNull();
    expect(leagueMarkUrl({ league_class_id: 'rl' })).toBeNull();
    expect(leagueMarkUrl(null)).toBeNull();
  });
});
