import { environment } from 'src/environments/environment';
import {
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
  ThumbnailInput,
  downloadThumbnail,
  ellipsize,
  hexWithAlpha,
  monogram,
  renderStreamThumbnail,
  resolveMediaUrl,
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
  it('bricht wortweise um', () => {
    const ctx = context();
    const lines = wrapText(ctx, 'EIN ZWEI DREI VIER', 120, 2);

    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.join(' ').replace(/…/g, '')).toContain('EIN');
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
});

describe('downloadThumbnail', () => {
  it('speichert unter dem übergebenen Namen', async () => {
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;

    await downloadThumbnail(canvas, 'thumbnail-test.png');

    expect(click).toHaveBeenCalled();
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
});
