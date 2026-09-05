import {
  CHUNK_RELOAD_MARKER,
  CHUNK_RELOAD_WINDOW_MS,
  ChunkRecoveryEnv,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from './chunk-load-recovery';

// Ein einfacher Sitzungsspeicher für den Test. Der echte `sessionStorage`
// überlebt zwischen den Fällen und würde den Merker mitschleppen.
function fakeStorage(initial: Record<string, string> = {}) {
  const values = { ...initial };
  return {
    values,
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  };
}

function env(overrides: Partial<ChunkRecoveryEnv> = {}): ChunkRecoveryEnv {
  return {
    now: () => 1_000_000,
    storage: fakeStorage(),
    online: () => true,
    reload: () => undefined,
    ...overrides,
  };
}

describe('isChunkLoadError', () => {
  // Die drei Formulierungen aus den Browsern. Safari und Firefox stehen so in
  // SAISONMANAGER-2B beziehungsweise 2Z; Chromes Fassung fehlt dort nur, weil
  // sie der ignoreErrors-Filter verschluckt hat.
  it('erkennt Safaris Formulierung', () => {
    expect(
      isChunkLoadError(new TypeError('Importing a module script failed.'))
    ).toBeTrue();
  });

  it('erkennt Chromes Formulierung', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://saisonmanager.de/chunk-Ds7N3Bw5.js'
        )
      )
    ).toBeTrue();
  });

  it('erkennt Firefox’ Formulierung', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'error loading dynamically imported module: https://saisonmanager.de/chunk-Ds7N3Bw5.js'
        )
      )
    ).toBeTrue();
  });

  it('erkennt den Namen ChunkLoadError auch ohne passende Meldung', () => {
    const error = new Error('irgendwas');
    error.name = 'ChunkLoadError';

    expect(isChunkLoadError(error)).toBeTrue();
  });

  // Angulars zone.js hängt den ursprünglichen Fehler unter `ngOriginalError`
  // ein, genau wie beim HTTP-Filter im FilteringErrorHandler.
  it('liest den Fehler aus Angulars zone.js-Hülle', () => {
    const wrapper = {
      ngOriginalError: new TypeError('Importing a module script failed.'),
    };

    expect(isChunkLoadError(wrapper)).toBeTrue();
  });

  // Der wichtigste Fall: Beim Wechsel in einen noch nicht geladenen Bereich
  // wickelt der Router den Ladefehler ein, und die Meldung steht nur in
  // `cause`. Ohne das Mitlesen der Kette greift die Erkennung ausgerechnet auf
  // dem häufigsten Weg nicht.
  it('liest den Fehler aus der cause-Kette', () => {
    const inner = new TypeError('Importing a module script failed.');
    const outer = new Error('NG0400: navigation failed', { cause: inner });

    expect(isChunkLoadError(outer)).toBeTrue();
  });

  it('bleibt bei einem selbstbezüglichen cause-Verweis nicht hängen', () => {
    const error: { message: string; cause?: unknown } = { message: 'kaputt' };
    error.cause = error;

    expect(isChunkLoadError(error)).toBeFalse();
  });

  it('hält einen gewöhnlichen Fehler nicht für einen Ladefehler', () => {
    expect(isChunkLoadError(new TypeError('x is not a function'))).toBeFalse();
    expect(isChunkLoadError(null)).toBeFalse();
    expect(isChunkLoadError('Importing')).toBeFalse();
  });
});

describe('recoverFromChunkLoadError', () => {
  it('lädt beim ersten Ladefehler neu und hinterlässt den Merker', () => {
    const reload = jasmine.createSpy('reload');
    const storage = fakeStorage();

    const reloaded = recoverFromChunkLoadError(
      env({ reload, storage, now: () => 5000 })
    );

    expect(reloaded).toBeTrue();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.values[CHUNK_RELOAD_MARKER]).toBe('5000');
  });

  // Der Kern des Schutzes: Fehlt die Datei wirklich — abgebrochenes Deploy —,
  // ist sie auch nach dem Neuladen nicht da. Ohne diesen Riegel lädt der Tab
  // sich endlos selbst neu und fragt den Server dabei im Takt der Ladezeit an.
  it('lädt innerhalb des Zeitfensters nicht ein zweites Mal', () => {
    const reload = jasmine.createSpy('reload');
    const storage = fakeStorage({ [CHUNK_RELOAD_MARKER]: '5000' });

    const reloaded = recoverFromChunkLoadError(
      env({ reload, storage, now: () => 5000 + CHUNK_RELOAD_WINDOW_MS - 1 })
    );

    expect(reloaded).toBeFalse();
    expect(reload).not.toHaveBeenCalled();
  });

  // Nach dem Fenster darf es erneut versuchen: Ein weiterer Deploy kann
  // zwischenzeitlich alles in Ordnung gebracht haben.
  it('lädt nach Ablauf des Zeitfensters wieder neu', () => {
    const reload = jasmine.createSpy('reload');
    const storage = fakeStorage({ [CHUNK_RELOAD_MARKER]: '5000' });

    const reloaded = recoverFromChunkLoadError(
      env({ reload, storage, now: () => 5000 + CHUNK_RELOAD_WINDOW_MS + 1 })
    );

    expect(reloaded).toBeTrue();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lädt ohne nutzbaren Speicher nicht neu', () => {
    const reload = jasmine.createSpy('reload');

    const reloaded = recoverFromChunkLoadError(env({ reload, storage: null }));

    expect(reloaded).toBeFalse();
    expect(reload).not.toHaveBeenCalled();
  });

  // Speicher vorhanden, Schreiben abgelehnt (privater Modus, Kontingent voll).
  // Ohne verlässlichen Merker gilt dasselbe wie ohne Speicher.
  it('lädt nicht neu, wenn der Merker sich nicht schreiben lässt', () => {
    const reload = jasmine.createSpy('reload');
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    const reloaded = recoverFromChunkLoadError(env({ reload, storage }));

    expect(reloaded).toBeFalse();
    expect(reload).not.toHaveBeenCalled();
  });
  // Chrome meldet ein Funkloch beim Nachladen mit derselben Zeichenkette wie
  // einen nach dem Deploy verschwundenen Chunk. Der Unterschied liegt in der
  // Folge: Nach einem Deploy behebt das Neuladen alles, ohne Netz ersetzt es
  // eine stehende Ansicht durch die Fehlerseite des Browsers.
  it('laedt ohne Netz nicht neu', () => {
    const reload = jasmine.createSpy('reload');

    const reloaded = recoverFromChunkLoadError(
      env({ reload, online: () => false })
    );

    expect(reloaded).toBeFalse();
    expect(reload).not.toHaveBeenCalled();
  });

  // Gegenprobe: Mit Netz bleibt es beim bisherigen Verhalten.
  it('laedt mit Netz weiterhin neu', () => {
    const reload = jasmine.createSpy('reload');

    const reloaded = recoverFromChunkLoadError(
      env({ reload, online: () => true })
    );

    expect(reloaded).toBeTrue();
    expect(reload).toHaveBeenCalled();
  });

  // Der Merker darf ohne Netz NICHT gesetzt werden: Sonst verbraucht ein
  // Funkloch das Zeitfenster, und das erste echte Deploy-Problem danach
  // bekaeme innerhalb der Minute kein Neuladen mehr.
  it('verbraucht ohne Netz das Zeitfenster nicht', () => {
    const storage = fakeStorage();
    const reload = jasmine.createSpy('reload');

    recoverFromChunkLoadError(env({ reload, storage, online: () => false }));
    expect(storage.getItem(CHUNK_RELOAD_MARKER)).toBeNull();

    const reloaded = recoverFromChunkLoadError(
      env({ reload, storage, online: () => true })
    );
    expect(reloaded).toBeTrue();
  });
});
