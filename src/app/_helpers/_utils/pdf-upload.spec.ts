import { isPdfFile } from './pdf-upload';

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
