import { environment } from 'src/environments/environment';
import {
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
  ThumbnailInput,
  downloadThumbnail,
  ellipsize,
  filenameSlug,
  hexWithAlpha,
  monogram,
  renderStreamThumbnail,
  resolveMediaUrl,
  thumbnailDateLine,
  thumbnailFilename,
  wrapText,
} from './stream-thumbnail';

function context(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('keine Leinwand');
  ctx.font = '32px sans-serif';

  return ctx;
}

function input(overrides: Partial<ThumbnailInput> = {}): ThumbnailInput {
  return {
    variant: 'livestream',
    competition: '2fbl-m',
    leagueName: '2. Floorball-Bundesliga Herren',
    markUrl: null,
    home: { name: 'UHC Sparkasse Weißenfels' },
    guest: { name: 'MFBC Grimma' },
    dateLine: 'Sa. 12.10.2026 · 18:00 Uhr',
    venue: 'Stadtbadhalle',
    ...overrides,
  };
}

describe('resolveMediaUrl', () => {
  it('lässt absolute Adressen unverändert', () => {
    expect(resolveMediaUrl('https://example.org/a.png')).toBe(
      'https://example.org/a.png'
    );
  });

  // Die mitgelieferten Bildmarken liegen im Frontend (angular.json kopiert
  // `overlay/` nach `/overlay/`), nicht in der API. Gegen die API aufgelöst
  // zeigten sie in der Entwicklung auf den Rails-Port und fehlten dort.
  it('löst mitgelieferte Dateien gegen die Seite auf', () => {
    expect(resolveMediaUrl('/overlay/img/pokal-weiss.png')).toBe(
      new URL('/overlay/img/pokal-weiss.png', document.baseURI).href
    );
  });

  it('löst Mediendateien gegen die API auf', () => {
    expect(resolveMediaUrl('/api/storage/blobs/redirect/x/logo.png')).toBe(
      new URL('/api/storage/blobs/redirect/x/logo.png', environment.apiURL).href
    );
  });

  it('gibt ohne Pfad nichts zurück', () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl('')).toBeNull();
  });
});

describe('monogram', () => {
  it('bildet das Kürzel aus den ersten drei Wörtern', () => {
    expect(monogram('UHC Sparkasse Weißenfels')).toBe('USW');
    expect(monogram('Berlin Rockets Floorball Verein')).toBe('BRF');
  });

  it('kommt ohne Namen zurecht', () => {
    expect(monogram('')).toBe('?');
    expect(monogram('   ')).toBe('?');
  });
});

describe('wrapText', () => {
  // Geprüft wird, DASS umgebrochen wurde und wo: Eine Zeile darf die Breite
  // nicht überschreiten, und kein Wort darf verschwinden.
  it('bricht wortweise um', () => {
    const ctx = context();
    const text = 'EINS ZWEI DREI';
    const maxWidth = ctx.measureText('EINS ZWEI').width;

    const lines = wrapText(ctx, text, maxWidth, 2);

    expect(lines.length).toBe(2);
    expect(lines[0]).toBe('EINS ZWEI');
    expect(lines[1]).toBe('DREI');
    expect(ctx.measureText(lines[0]).width).toBeLessThanOrEqual(maxWidth);
  });

  // Was nicht mehr passt, wird gekürzt und nicht weggelassen: Ein
  // stillschweigend abgeschnittener Vereinsname ist eine falsche Angabe.
  it('kürzt die letzte Zeile sichtbar', () => {
    const ctx = context();
    const lines = wrapText(ctx, 'EINS ZWEI DREI VIER FÜNF SECHS SIEBEN', 90, 2);

    expect(lines.length).toBe(2);
    expect(lines[1].endsWith('…')).toBeTrue();
  });
});

describe('ellipsize', () => {
  it('lässt Passendes stehen', () => {
    const ctx = context();
    expect(ellipsize(ctx, 'kurz', 1000)).toBe('kurz');
  });

  it('kürzt Zulanges', () => {
    const ctx = context();
    const cut = ellipsize(ctx, 'ein sehr langer Hallenname am Stadtrand', 100);

    expect(cut.endsWith('…')).toBeTrue();
    expect(ctx.measureText(cut).width).toBeLessThanOrEqual(100);
  });
});

describe('hexWithAlpha', () => {
  it('rechnet in rgba um', () => {
    expect(hexWithAlpha('#e94560', 0.5)).toBe('rgba(233, 69, 96, 0.5)');
  });

  it('lässt unbekannte Werte unangetastet', () => {
    expect(hexWithAlpha('currentColor', 0.5)).toBe('currentColor');
  });
});

describe('thumbnailFilename', () => {
  it('setzt Umlaute um und trennt mit Bindestrichen', () => {
    expect(
      thumbnailFilename({
        variant: 'highlights',
        home: { name: 'UHC Sparkasse Weißenfels' },
        guest: { name: 'MFBC Grimma' },
      })
    ).toBe('thumbnail-highlights-uhc-sparkasse-weissenfels-mfbc-grimma.png');
  });

  // Alle vier Umsetzungen, nicht nur das ß: Ein Dateiname mit Prozentzeichen
  // oder rohem Umlaut ist je nach Betriebssystem des Streamers unhandlich.
  it('setzt auch ä, ö und ü um', () => {
    expect(
      thumbnailFilename({
        variant: 'livestream',
        home: { name: 'Grün-Weiß Köln' },
        guest: { name: 'TV Bad Dürkheim' },
      })
    ).toBe('thumbnail-livestream-gruen-weiss-koeln-tv-bad-duerkheim.png');
  });
});

describe('renderStreamThumbnail', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
  });

  it('zeichnet in 1280 × 720', async () => {
    await renderStreamThumbnail(canvas, input());

    expect(canvas.width).toBe(THUMBNAIL_WIDTH);
    expect(canvas.height).toBe(THUMBNAIL_HEIGHT);
  });

  // Der Beleg dafür, dass die Farbwelt des Wettbewerbs wirklich im Bild landet
  // und nicht bloß in einer Variablen steht: Die Akzentkante oben trägt am
  // linken Rand genau den Akzentton der 2. Bundesliga Herren (#2ec4b6).
  it('trägt den Akzent des Wettbewerbs', async () => {
    await renderStreamThumbnail(canvas, input({ competition: '2fbl-m' }));

    const ctx = canvas.getContext('2d');
    const pixel = ctx?.getImageData(0, 5, 1, 1).data;

    expect(Array.from(pixel ?? [])).toEqual([46, 196, 182, 255]);
  });

  it('schreibt Paarung, Liga und Kennzeichen ins Bild', async () => {
    const texts: string[] = [];
    spyOn(CanvasRenderingContext2D.prototype, 'fillText').and.callFake(
      function (this: CanvasRenderingContext2D, text: string) {
        texts.push(text);
      }
    );

    await renderStreamThumbnail(
      canvas,
      // Kurze Namen: Ob ein langer Name ein- oder zweizeilig gesetzt wird,
      // hängt an den Maßen der Schrift, und die Schriftdateien liegen unter
      // Karma nicht bereit. Der Umbruch selbst ist bei `wrapText` geprüft, hier
      // geht es darum, DASS Paarung, Liga und Kennzeichen im Bild stehen.
      input({ home: { name: 'ETV Hamburg' }, guest: { name: 'MFBC Grimma' } })
    );

    expect(texts).toContain('ETV HAMBURG');
    expect(texts).toContain('MFBC GRIMMA');
    expect(texts).toContain('2. FLOORBALL-BUNDESLIGA HERREN');
    expect(texts).toContain('LIVESTREAM');
    expect(texts).toContain('VS');
    expect(texts).toContain('Sa. 12.10.2026 · 18:00 Uhr');
  });

  it('setzt im Highlight-Bild den Endstand an die Stelle des VS', async () => {
    const texts: string[] = [];
    spyOn(CanvasRenderingContext2D.prototype, 'fillText').and.callFake(
      function (this: CanvasRenderingContext2D, text: string) {
        texts.push(text);
      }
    );

    await renderStreamThumbnail(
      canvas,
      input({
        variant: 'highlights',
        home: { name: 'ETV Hamburg' },
        guest: { name: 'MFBC Grimma' },
        score: { home: 5, guest: 3, postfix: 'n.V.' },
      })
    );

    expect(texts).toContain('5:3');
    expect(texts).toContain('n.V.');
    expect(texts).toContain('HIGHLIGHTS');
    expect(texts).not.toContain('VS');
  });

  // Ohne Wappen steht das Kürzel da, und die Oberfläche erfährt davon: Ein
  // stumm fehlendes Wappen sähe wie ein Gestaltungsfehler aus.
  it('meldet ein Wappen, das nicht geladen werden konnte', async () => {
    const result = await renderStreamThumbnail(
      canvas,
      input({
        home: { name: 'UHC Sparkasse Weißenfels', logoUrl: '/nicht/da.png' },
      })
    );

    expect(result.missing).toContain('home');
  });

  it('meldet nichts, wenn gar kein Wappen hinterlegt ist', async () => {
    const result = await renderStreamThumbnail(canvas, input());

    expect(result.missing).toEqual([]);
  });

  // Der einzige Test, der ein Wappen wirklich lädt und zeichnet: Ohne ihn liefe
  // `drawCrest` mit seiner Einpassungsrechnung in keinem Lauf, und ob sich die
  // fertige Leinwand überhaupt noch ausgeben lässt, wäre ebenfalls ungeprüft.
  // Die CORS-Frage beantwortet er nicht (dazu bräuchte es einen fremden Host),
  // wohl aber den Weg vom geladenen Bild bis zur Datei.
  it('zeichnet ein geladenes Wappen und bleibt exportierbar', async () => {
    const source = document.createElement('canvas');
    source.width = 8;
    source.height = 8;
    const sourceCtx = source.getContext('2d');
    sourceCtx!.fillStyle = '#ff0000';
    sourceCtx!.fillRect(0, 0, 8, 8);

    const result = await renderStreamThumbnail(
      canvas,
      input({
        home: { name: 'ETV Hamburg', logoUrl: source.toDataURL('image/png') },
      })
    );

    expect(result.missing).toEqual([]);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    expect(blob).not.toBeNull();
    expect(blob!.size).toBeGreaterThan(0);
  });

  // Unter Karma liegt `overlay/fonts` nicht bereit, hier ist der Fehlschlag also
  // der Normalfall -- und genau der muss gemeldet werden, statt ein Bild in der
  // Die Schriften liegen im Prüflauf bereit (`overlay` ist in angular.json auch
  // für das Test-Target als Asset eingetragen). Das ist kein Beiwerk: Ohne sie
  // lief jeder Prüfsatz durch den Zweig „Schriften fehlen", und ein Bild in der
  // Ersatzschrift war von einem richtigen nicht zu unterscheiden.
  it('sagt, ob die Schriften zur Verfügung standen', async () => {
    const result = await renderStreamThumbnail(canvas, input());

    expect(result.fontsLoaded).toBeTrue();
  });
});

describe('downloadThumbnail', () => {
  it('speichert unter dem übergebenen Namen', async () => {
    let saved = '';
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (
      this: HTMLAnchorElement
    ) {
      saved = this.download;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;

    await downloadThumbnail(canvas, 'thumbnail-test.png');

    expect(saved).toBe('thumbnail-test.png');
  });

  // Eine verunreinigte Leinwand (fremde Herkunft ohne CORS) lässt `toBlob`
  // werfen. Bliebe das stumm, klickte der Streamer weiter und fände nie eine
  // Datei.
  it('meldet einen Fehlschlag, statt ihn zu verschlucken', async () => {
    const canvas = {
      toBlob: () => {
        throw new Error('SecurityError');
      },
    } as unknown as HTMLCanvasElement;

    await expectAsync(
      downloadThumbnail(canvas, 'thumbnail-test.png')
    ).toBeRejected();
  });

  it('meldet auch ein leeres Ergebnis', async () => {
    const canvas = {
      toBlob: (callback: (blob: Blob | null) => void) => callback(null),
    } as unknown as HTMLCanvasElement;

    await expectAsync(
      downloadThumbnail(canvas, 'thumbnail-test.png')
    ).toBeRejected();
  });

  // Ein Blob OHNE INHALT ist der heimtückischere Fall: Er ist nicht `null`, und
  // ohne Prüfung landete eine 0-Byte-Datei im Download-Ordner bzw. im Archiv
  // des Stapels -- dort sieht sie niemand an, und sie fällt erst bei YouTube auf.
  it('meldet einen Blob ohne Inhalt als Fehlschlag', async () => {
    const canvas = {
      toBlob: (callback: (blob: Blob | null) => void) =>
        callback(new Blob([], { type: 'image/png' })),
    } as unknown as HTMLCanvasElement;

    await expectAsync(
      downloadThumbnail(canvas, 'thumbnail-test.png')
    ).toBeRejected();
  });
});

describe('filenameSlug', () => {
  it('setzt Umlaute um, statt sie zu entfernen', () => {
    expect(filenameSlug('SG Grün-Weiß Königsbrunn')).toBe(
      'sg-gruen-weiss-koenigsbrunn'
    );
  });

  // Die Kürzung auf 40 Zeichen ist der Grund, warum der Stapel eine laufende
  // Nummer voranstellt: Zwei lange Vereinsnamen können sich gekürzt gleichen,
  // und zwei gleiche Namen in einem Archiv überschreiben sich beim Auspacken.
  it('kürzt auf 40 Zeichen', () => {
    const slug = filenameSlug(
      'Floorball Vereinigung Ostwestfalen-Lippe Zweite Mannschaft'
    );

    expect(slug.length).toBe(40);
    expect(slug).toBe('floorball-vereinigung-ostwestfalen-lippe');
  });

  it('lässt nichts als Bindestriche stehen', () => {
    expect(filenameSlug('   ')).toBe('');
    expect(filenameSlug('...')).toBe('');
  });
});

/**
 * Die Datumszeile hängt an ZWEI Wegen: dem einzelnen Bild im Spielbericht und
 * dem Stapel eines Spieltags. Genau deshalb steht sie hier und nicht in einer
 * Komponente -- und deshalb gehört ihr Prüfsatz ebenfalls hierher, statt in dem
 * einer der beiden Komponenten zu hängen.
 */
describe('thumbnailDateLine', () => {
  it('setzt Wochentag und Datum ohne Zeitzonenumweg', () => {
    expect(thumbnailDateLine('2026-01-11', '18:00', 'livestream')).toBe(
      'So. 11.01.2026 · 18:00 Uhr'
    );
  });

  // Das Highlight-Bild trägt den Endstand; die Anwurfzeit ist dort ohne Belang.
  // Die Regel gehört zum Bildaufbau, nicht zum Aufrufer.
  it('lässt beim Highlight-Bild die Anwurfzeit weg', () => {
    expect(thumbnailDateLine('2026-01-11', '18:00', 'highlights')).toBe(
      'So. 11.01.2026'
    );
  });

  it('fällt beim Livestream-Bild auf die Anwurfzeit zurück', () => {
    expect(thumbnailDateLine('', '18:00', 'livestream')).toBe('18:00 Uhr');
    expect(thumbnailDateLine('kein Datum', '18:00', 'livestream')).toBe(
      '18:00 Uhr'
    );
  });

  // Beim Highlight-Bild bleibt die Zeile in diesem Fall LEER: Eine Uhrzeit ohne
  // Datum ist neben einem Endstand keine Auskunft, sondern eine Irritation.
  it('bleibt beim Highlight-Bild ohne lesbares Datum leer', () => {
    expect(thumbnailDateLine('', '18:00', 'highlights')).toBe('');
  });

  it('kommt ohne beide Angaben zurecht', () => {
    expect(thumbnailDateLine(null, null, 'livestream')).toBe('');
    expect(thumbnailDateLine(undefined, undefined, 'livestream')).toBe('');
  });

  // `Game.date` ist im Modell als `Date` deklariert, obwohl die API Text
  // liefert. Ein tatsächlich übergebenes `Date` darf das Datum nicht
  // stillschweigend verschlucken -- über `String(date)` täte es das, denn
  // „Sun Jan 11 2026 …" passt auf keine Datumsregel.
  it('nimmt auch ein echtes Date', () => {
    expect(
      thumbnailDateLine(new Date(2026, 0, 11), '18:00', 'livestream')
    ).toBe('So. 11.01.2026 · 18:00 Uhr');
    expect(thumbnailDateLine(new Date(NaN), '18:00', 'livestream')).toBe(
      '18:00 Uhr'
    );
  });
});
