import { buildObsSceneCollection, fullscreenUrl } from './obs-scene-collection';

interface ObsSource {
  name: string;
  id: string;
  settings: Record<string, unknown>;
}

interface ObsCollection {
  name: string;
  current_scene: string;
  current_program_scene: string;
  scene_order: { name: string }[];
  sources: ObsSource[];
}

describe('buildObsSceneCollection', () => {
  const overlayUrl = 'https://saisonmanager.de/overlay/index.html?token=abc123';

  function build(): ObsCollection {
    return buildObsSceneCollection({
      overlayUrl,
      collectionName: 'Saisonmanager – Spiel 12',
    }) as unknown as ObsCollection;
  }

  it('legt die Bühne und zehn Vollbilder als Szenen an', () => {
    const collection = build();
    const scenes = collection.sources.filter((s) => s.id === 'scene');

    expect(scenes.length).toBe(11);
    expect(collection.scene_order.length).toBe(11);
  });

  it('macht die Bühne zur aktiven Szene', () => {
    const collection = build();

    // Wer die Datei einliest und auf Sendung geht, soll die Anzeigetafel sehen
    // und nicht ein Vollbild.
    expect(collection.current_scene).toContain('Bühne');
    expect(collection.current_program_scene).toBe(collection.current_scene);
    expect(collection.scene_order[0].name).toBe(collection.current_scene);
  });

  it('setzt jede Browser-Quelle auf 1920 x 1080', () => {
    const browsers = build().sources.filter((s) => s.id === 'browser_source');

    expect(browsers.length).toBe(11);
    browsers.forEach((source) => {
      expect(source.settings['width']).toBe(1920);
      expect(source.settings['height']).toBe(1080);
    });
  });

  // Ohne „Quelle beim Ausblenden abschalten" fragen alle inaktiven
  // Vollbild-Szenen die ganze Zeit mit. Die laufende Bühne darf es
  // ausdrücklich NICHT haben, sonst lädt sie beim Szenenwechsel neu und
  // verliert Uhr und Einblendung.
  it('schaltet Vollbilder beim Ausblenden ab, die Bühne nicht', () => {
    const browsers = build().sources.filter((s) => s.id === 'browser_source');
    const stage = browsers.find(
      (s) => !String(s.settings['url']).includes('only=fullscreen')
    );
    const fullscreens = browsers.filter((s) =>
      String(s.settings['url']).includes('only=fullscreen')
    );

    expect(stage!.settings['shutdown']).toBeFalse();
    expect(fullscreens.length).toBe(10);
    fullscreens.forEach((source) => {
      expect(source.settings['shutdown']).toBeTrue();
    });
  });

  // Die Szenennamen sind die Schnittstelle zu overlay.js. Wer sie dort
  // umbenennt, macht jede verteilte Sammlung kaputt — dieser Test hält beide
  // Seiten zusammen.
  it('benutzt genau die Szenennamen, die overlay.js kennt', () => {
    const urls = build()
      .sources.filter((s) => s.id === 'browser_source')
      .map((s) => String(s.settings['url']));

    [
      'startbild',
      'aufstellung-heim',
      'aufstellung-gast',
      'drittelpause',
      'tore',
      'endstand',
      'tabelle',
      'topscorer',
      'naechste-spiele',
      'formkurve',
    ].forEach((slug) => {
      expect(urls).toContain(
        `https://saisonmanager.de/overlay/index.html?token=abc123&only=fullscreen&scene=${slug}`
      );
    });
  });

  it('setzt das Token in jede Quelle ein', () => {
    build()
      .sources.filter((s) => s.id === 'browser_source')
      .forEach((source) => {
        expect(String(source.settings['url'])).toContain('token=abc123');
      });
  });

  it('ueberlebt JSON.stringify ohne Zyklen', () => {
    expect(() => JSON.stringify(build())).not.toThrow();
  });

  // Der Name der Quelle steht an zwei Stellen und wird an beiden aus derselben
  // Vorlage gebaut, aber getrennt. Laeuft eine der beiden auseinander -- ein
  // umbenanntes Label, ein Halbgeviertstrich, der zum Bindestrich wird --,
  // enthaelt die Datei weiter neun Quellen und neun Szenen, und trotzdem sind
  // beim Verein alle Szenen leer. Das faellt erst auf Sendung auf.
  it('verweist jede Szene auf eine Quelle, die es gibt', () => {
    const collection = build();
    const sourceNames = collection.sources
      .filter((s) => s.id === 'browser_source')
      .map((s) => s.name);
    const referenced = collection.sources
      .filter((s) => s.id === 'scene')
      .flatMap((s) => (s.settings['items'] as { name: string }[]) ?? [])
      .map((item) => item.name);

    expect(referenced.length).toBe(11);
    expect(referenced.slice().sort()).toEqual(sourceNames.slice().sort());
  });

  // Bei doppelten Namen loest OBS die Kollision beim Import still auf, und die
  // Sammlung kommt anders wieder heraus, als sie hineingegangen ist.
  it('vergibt jeden Quell- und Szenennamen nur einmal', () => {
    const names = build().sources.map((s) => s.name);

    expect(new Set(names).size).toBe(names.length);
  });
});

describe('fullscreenUrl', () => {
  // Die Adresse traegt schon ?token=; ein angehaengtes ?only= ergaebe eine
  // kaputte Anfrage.
  it('haengt an eine Adresse mit Parametern korrekt an', () => {
    expect(
      fullscreenUrl('https://example.org/overlay/index.html?token=x', 'tabelle')
    ).toBe(
      'https://example.org/overlay/index.html?token=x&only=fullscreen&scene=tabelle'
    );
  });

  it('kommt auch ohne Parameter und mit einer unbrauchbaren Adresse zurecht', () => {
    expect(fullscreenUrl('https://example.org/overlay/', 'endstand')).toBe(
      'https://example.org/overlay/?only=fullscreen&scene=endstand'
    );
    expect(fullscreenUrl('nicht-mal-eine-adresse', 'endstand')).toBe(
      'nicht-mal-eine-adresse?only=fullscreen&scene=endstand'
    );
  });
});
