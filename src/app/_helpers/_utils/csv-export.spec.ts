import { CsvCell, toCsv } from './csv-export';

describe('toCsv', () => {
  function cells(...values: CsvCell[]): string {
    return toCsv([], [values]).replace(/^\r\n/, '');
  }

  it('quotet jede Zelle und verdoppelt Anführungszeichen', () => {
    expect(toCsv(['A', 'B'], [['x "y"', null]])).toBe(
      '"A";"B"\r\n"x ""y""";""'
    );
  });

  // OWASP "CSV Injection": Freitexte aus der Datenbank dürfen beim Öffnen in
  // Excel nicht als Formel laufen.
  it('stellt Formelanfängen ein Hochkomma voran', () => {
    expect(cells('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(cells('+SUM(A1)', '-1+1 Text', '@cmd')).toBe(
      `"'+SUM(A1)";"'-1+1 Text";"'@cmd"`
    );
    expect(cells('\t=1', '\r=1')).toBe(`"'\t=1";"'\r=1"`);
  });

  it('lässt Zahlen und reine Zahlentexte unverändert', () => {
    expect(cells(-3, '-3', '+2', '1,5', '-0.25')).toBe(
      '"-3";"-3";"+2";"1,5";"-0.25"'
    );
  });

  it('lässt gewöhnlichen Text unverändert', () => {
    expect(cells('Muster', 'a=b', '')).toBe('"Muster";"a=b";""');
  });
});
