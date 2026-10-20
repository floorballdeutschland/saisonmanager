import { checkPdfUpload, hasPdfSignature, isPdfFile } from './pdf-upload';

describe('isPdfFile', () => {
  const file = (name: string, type: string) => new File(['x'], name, { type });

  it('nimmt ein PDF an', () => {
    expect(isPdfFile(file('bogen.pdf', 'application/pdf'))).toBeTrue();
  });

  it('weist Fotos ab', () => {
    expect(isPdfFile(file('bogen.jpg', 'image/jpeg'))).toBeFalse();
    expect(isPdfFile(file('bogen.png', 'image/png'))).toBeFalse();
  });

  it('weist ein in .pdf umbenanntes Foto ab', () => {
    expect(isPdfFile(file('bogen.pdf', 'image/jpeg'))).toBeFalse();
  });

  it('entscheidet ohne Typangabe nach der Endung', () => {
    expect(isPdfFile(file('BOGEN.PDF', ''))).toBeTrue();
    expect(isPdfFile(file('bogen.heic', ''))).toBeFalse();
  });
});

describe('hasPdfSignature', () => {
  it('findet die Kennung am Dateianfang', async () => {
    expect(
      await hasPdfSignature(new File(['%PDF-1.7 rest'], 'a.pdf'))
    ).toBeTrue();
  });

  it('findet die Kennung hinter Vorspann, wie die API', async () => {
    expect(
      await hasPdfSignature(new File(['\n\n%PDF-1.4'], 'a.pdf'))
    ).toBeTrue();
  });

  it('erkennt ein Foto ohne Kennung', async () => {
    const png = new File(['\x89PNG\r\n\x1a\n'], 'a.pdf');
    expect(await hasPdfSignature(png)).toBeFalse();
  });
});

describe('checkPdfUpload', () => {
  // Der Browser setzt den Typ nach der Endung: Ein umbenanntes Foto meldet er
  // als application/pdf.
  it('weist ein in .pdf umbenanntes Foto ab', async () => {
    const renamed = new File(['\x89PNG\r\n\x1a\n'], 'bogen.pdf', {
      type: 'application/pdf',
    });
    expect(await checkPdfUpload(renamed)).toBeFalse();
  });

  it('nimmt ein echtes PDF an', async () => {
    const pdf = new File(['%PDF-1.4'], 'bogen.pdf', {
      type: 'application/pdf',
    });
    expect(await checkPdfUpload(pdf)).toBeTrue();
  });
});
