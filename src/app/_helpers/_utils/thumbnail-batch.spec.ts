import { League } from '@floorball/types';
import {
  ThumbnailBatchGame,
  ThumbnailBatchGameDay,
  ThumbnailBatchItem,
  ThumbnailBatchReport,
  entryName,
  folderName,
  renderThumbnailBatch,
  thumbnailInput,
} from './thumbnail-batch';

/**
 * Die Schleife selbst, nicht über die Komponente.
 *
 * Der Knopf im Ligaspielplan deckt sie nur für EINEN Spieltag ab -- er reicht
 * `hooks.league` ohne Kennung durch und kennt nur eine Liga. Alles, was es an
 * dieser Schleife überhaupt nur wegen des Streaming-Bereichs gibt (mehrere
 * Spieltage, mehrere Ligen, ein Zwischenspeicher je Kennung), liefe dort nie.
 */
describe('renderThumbnailBatch', () => {
  function game(name: string): ThumbnailBatchGame {
    return {
      start_time: '18:00',
      home_team_name: name,
      guest_team_name: 'Gast',
    };
  }

  function gameDay(
    overrides: Partial<ThumbnailBatchGameDay> = {}
  ): ThumbnailBatchGameDay {
    return {
      number: 3,
      date: '2026-01-11',
      league_id: 42,
      arena: { name: 'Stadtbadhalle' },
      ...overrides,
    };
  }

  function hooks(
    league: (id: number) => Promise<League | null>,
    overrides: Partial<Parameters<typeof renderThumbnailBatch>[1]> = {}
  ) {
    return {
      league,
      progress: () => undefined,
      capture: () => undefined,
      cancelled: () => false,
      ...overrides,
    };
  }

  it('legt je Spieltag einen eigenen Ordner an und zählt über den ganzen Stapel durch', async () => {
    const items: ThumbnailBatchItem[] = [
      { game: game('Erste'), gameDay: gameDay() },
      {
        game: game('Zweite'),
        gameDay: gameDay({ number: 4, date: '2026-01-12' }),
      },
    ];

    const { entries } = await renderThumbnailBatch(
      items,
      hooks(async () => null)
    );

    expect(entries.length).toBe(2);
    expect(entries[0].name).toContain('spieltag-3-2026-01-11/01-');
    expect(entries[1].name).toContain('spieltag-4-2026-01-12/02-');
  });

  // `buildZip` WIRFT bei zwei gleichen Namen. Ein Rückfall auf eine
  // ordnerinterne Nummer verlöre deshalb nicht ein Bild, sondern das ganze
  // Archiv -- nach allem Zeichnen, mit der Meldung "ließen sich nicht
  // speichern".
  it('vergibt auch bei gleicher Paarung an einem Tag eindeutige Namen', async () => {
    const items: ThumbnailBatchItem[] = [
      { game: game('Gleich'), gameDay: gameDay() },
      { game: game('Gleich'), gameDay: gameDay() },
    ];

    const { entries } = await renderThumbnailBatch(
      items,
      hooks(async () => null)
    );

    expect(entries[0].name).not.toBe(entries[1].name);
  });

  it('holt jede Liga nur einmal', async () => {
    const abrufe: number[] = [];
    const items: ThumbnailBatchItem[] = [
      { game: game('A'), gameDay: gameDay({ league_id: 1 }) },
      { game: game('B'), gameDay: gameDay({ league_id: 1 }) },
      { game: game('C'), gameDay: gameDay({ league_id: 2 }) },
    ];
    const zwischenspeicher = new Map<number, League | null>();

    await renderThumbnailBatch(
      items,
      hooks(async (id) => {
        if (zwischenspeicher.has(id)) return zwischenspeicher.get(id)!;
        abrufe.push(id);
        zwischenspeicher.set(id, null);
        return null;
      })
    );

    expect(abrufe).toEqual([1, 2]);
  });

  it('fragt die Liga des jeweiligen Spieltags ab, nicht eine feste', async () => {
    const gefragt: number[] = [];
    const items: ThumbnailBatchItem[] = [
      { game: game('A'), gameDay: gameDay({ league_id: 7 }) },
      { game: game('B'), gameDay: gameDay({ league_id: 9 }) },
    ];

    await renderThumbnailBatch(
      items,
      hooks(async (id) => {
        gefragt.push(id);
        return null;
      })
    );

    expect(gefragt).toEqual([7, 9]);
  });

  it('bricht nach einem Abbruchsignal mit Teilergebnis ab', async () => {
    const fortschritt: number[] = [];
    let bearbeitet = 0;
    const items: ThumbnailBatchItem[] = [1, 2, 3, 4].map((n) => ({
      game: game(`Nr ${n}`),
      gameDay: gameDay(),
    }));

    const { entries, aborted } = await renderThumbnailBatch(
      items,
      hooks(async () => null, {
        progress: (done: number) => {
          fortschritt.push(done);
          bearbeitet = done;
        },
        cancelled: () => bearbeitet >= 2,
      })
    );

    expect(aborted).toBeTrue();
    expect(entries.length).toBe(2);
    expect(fortschritt).toEqual([1, 2]);
  });

  // Ohne Liga bleibt die Kopfzeile leer -- einen Rückfall auf ein Spielfeld gibt
  // es NICHT. `meta_hash` nennt die Liga nicht, und genau dieser Rückfall war
  // der Fehler der ersten Fassung.
  it('setzt ohne Liga einen leeren Liganamen statt zu raten', () => {
    const eingabe = thumbnailInput(
      { game: game('Heim'), gameDay: gameDay() },
      null
    );

    expect(eingabe.leagueName).toBe('');
    expect(eingabe.venue).toBe('Stadtbadhalle');
    expect(eingabe.home.name).toBe('Heim');
  });

  it('setzt N.N. für eine noch nicht ausgeloste Mannschaft', () => {
    const eingabe = thumbnailInput(
      { game: { ...game(''), guest_team_name: '' }, gameDay: gameDay() },
      null
    );

    expect(eingabe.home.name).toBe('N.N.');
    expect(eingabe.guest.name).toBe('N.N.');
  });

  describe('folderName', () => {
    it('benennt Spieltag und Datum', () => {
      expect(folderName(gameDay())).toBe('spieltag-3-2026-01-11');
    });

    it('faellt ohne Nummer und Datum auf einen festen Namen zurueck', () => {
      expect(folderName({ number: 0, date: '', league_id: 1 })).toBe(
        'spieltag'
      );
    });
  });

  describe('entryName', () => {
    it('stellt die laufende Nummer voran', () => {
      const item = { game: game('Heim'), gameDay: gameDay() };
      const eingabe = thumbnailInput(item, null);

      expect(entryName(item, 8, eingabe)).toBe(
        'spieltag-3-2026-01-11/09-18-00-heim-gast.png'
      );
    });

    it('setzt ohne Anwurfzeit einen Platzhalter statt einer Luecke', () => {
      const item = {
        game: { ...game('Heim'), start_time: '' },
        gameDay: gameDay(),
      };

      expect(entryName(item, 0, thumbnailInput(item, null))).toContain(
        'ohne-zeit'
      );
    });
  });

  describe('ThumbnailBatchReport', () => {
    // Beim Umbau ist `_leagueMissing` von `boolean` auf `Set<number>` gewechselt.
    // Die Entdopplung -- einmal sagen, nicht viermal -- war unbelegt.
    it('nennt mehrere fehlende Ligen zusammengefasst', () => {
      const report = new ThumbnailBatchReport();
      report.recordLeagueMissing(1);
      report.recordLeagueMissing(2);
      report.recordLeagueMissing(1);

      expect(report.problems()).toContain('für 2 Ligen');
    });

    it('nennt eine einzelne fehlende Liga im Singular', () => {
      const report = new ThumbnailBatchReport();
      report.recordLeagueMissing(1);
      report.recordLeagueMissing(1);

      const text = report.problems();
      expect(text).toContain('Die Ligadaten ließen sich nicht laden');
      expect(text).not.toContain('für 2 Ligen');
    });

    it('meldet einen vollstaendigen Durchgang als Erfolg', () => {
      expect(new ThumbnailBatchReport().result(6, 6)).toEqual({
        level: 'success',
        text: '6 Thumbnails als ZIP gespeichert.',
      });
    });

    it('meldet einen unvollstaendigen Durchgang als Warnung mit Grund', () => {
      const report = new ThumbnailBatchReport();
      report.recordFailure(game('Kaputt'));

      const { level, text } = report.result(5, 6);

      expect(level).toBe('warning');
      expect(text).toContain('5 von 6');
      expect(text).toContain('Kaputt');
    });
  });
});
