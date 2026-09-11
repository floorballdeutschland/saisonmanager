import { StreamingGame } from '@floorball/types';
import {
  STREAM_TITLE_MAX,
  applyStreamTemplate,
  sanitizeStreamTitle,
} from './stream-template';

describe('stream-template', () => {
  function game(overrides: Partial<StreamingGame> = {}): StreamingGame {
    return {
      id: 1,
      game_number: '2',
      start_time: '18:00',
      start_at: '2026-09-12T18:00:00+02:00',
      home_team_name: 'MFBC Leipzig',
      guest_team_name: 'Floor Fighters Chemnitz',
      public_url: 'https://saisonmanager.de/fd/5/spiel/1',
      live_stream_link: null,
      vod_link: null,
      stream_key: 'abcd',
      streamable: true,
      privacy_default: 'public',
      game_day: {
        id: 1,
        number: 1,
        date: '2026-09-12',
        league_id: 5,
        hosting_club: 'MFBC Leipzig',
        hosting_club_id: 7,
        hosting_club_unlisted: false,
        arena: { name: 'Sporthalle Dösner Weg', city: 'Leipzig' },
      },
      league: {
        id: 5,
        name: '1. FBL Herren',
        short_name: '1. FBL',
        stream_playlist: null,
      },
      broadcast: null,
      ...overrides,
    };
  }

  // Genau die Form, die die Excel-Formel bisher gebaut hat.
  it('baut den bisherigen Titel', () => {
    expect(
      applyStreamTemplate(
        '{heim} vs {gast} | {liga} | {datum} | {spielnummer}',
        game()
      )
    ).toBe(
      'MFBC Leipzig vs Floor Fighters Chemnitz | 1. FBL Herren | 12.09.26 | 2'
    );
  });

  it('kennt Wochentag, langes Datum, Halle, Ort und Ausrichter', () => {
    expect(
      applyStreamTemplate(
        '{wochentag}, {datum_lang}, {uhrzeit} – {halle}, {ort} ({ausrichter})',
        game()
      )
    ).toBe(
      'Samstag, 12.09.2026, 18:00 – Sporthalle Dösner Weg, Leipzig (MFBC Leipzig)'
    );
  });

  it('setzt die öffentliche Spielseite ein', () => {
    expect(applyStreamTemplate('Ticker: {spiel_url}', game())).toBe(
      'Ticker: https://saisonmanager.de/fd/5/spiel/1'
    );
  });

  // Stillschweigend zu löschen wäre die schlechtere Antwort: Ein Tippfehler
  // fiele dann erst auf, wenn zwanzig Streams mit einer Lücke im Titel stehen.
  it('lässt einen unbekannten Platzhalter stehen', () => {
    expect(applyStreamTemplate('{heim} {spielnumer}', game())).toBe(
      'MFBC Leipzig {spielnumer}'
    );
  });

  it('füllt fehlende Angaben leer statt mit undefined', () => {
    const ohne = game({ league: null, game_day: null, game_number: null });

    expect(applyStreamTemplate('[{liga}][{halle}][{spielnummer}]', ohne)).toBe(
      '[][][]'
    );
  });

  it('setzt N.N. für eine noch nicht ausgeloste Mannschaft', () => {
    expect(
      applyStreamTemplate('{heim} vs {gast}', game({ home_team_name: '' }))
    ).toBe('N.N. vs Floor Fighters Chemnitz');
  });

  // `new Date('2026-09-12')` liest die Form als UTC-Mitternacht; der Wochentag
  // wäre in westlichen Zeitzonen um einen Tag verschoben.
  it('liest das Datum ortszeitlich', () => {
    expect(applyStreamTemplate('{wochentag}', game())).toBe('Samstag');
  });

  it('ignoriert ein unbrauchbares Datum, statt zu scheitern', () => {
    const kaputt = game({
      game_day: { ...game().game_day!, date: '11.08.2026' },
    });

    expect(applyStreamTemplate('[{datum}][{wochentag}]', kaputt)).toBe('[][]');
  });

  describe('sanitizeStreamTitle', () => {
    it('entfernt spitze Klammern und Zeilenumbrüche', () => {
      expect(sanitizeStreamTitle('A <b>\nC')).toBe('A b C');
    });

    it('kürzt an der Wortgrenze auf die Höchstlänge', () => {
      const lang = `${'Sehr langer Vereinsname '.repeat(6)}Ende`;

      const gekuerzt = sanitizeStreamTitle(lang);

      expect(gekuerzt.length).toBeLessThanOrEqual(STREAM_TITLE_MAX);
      expect(gekuerzt.endsWith(' ')).toBeFalse();
      expect(lang.startsWith(gekuerzt)).toBeTrue();
    });

    it('lässt einen kurzen Titel unangetastet', () => {
      expect(sanitizeStreamTitle('MFBC Leipzig vs FFC')).toBe(
        'MFBC Leipzig vs FFC'
      );
    });
  });
});
