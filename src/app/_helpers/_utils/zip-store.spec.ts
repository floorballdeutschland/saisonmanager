import { buildZip, crc32, dosDateTime } from './zip-store';

/**
 * Ein ZIP wird immer über das zentrale Verzeichnis gelesen. Dieser Prüfsatz
 * liest es genauso -- Signaturen und Abstände Feld für Feld: Ein falscher
 * Abstand erzeugt eine Datei, die vollständig aussieht und sich nicht auspacken
 * lässt, und das fiele sonst erst dem Empfänger auf.
 */
describe('zip-store', () => {
  const encoder = new TextEncoder();

  function bytes(value: string): Uint8Array<ArrayBuffer> {
    // Über den Puffer, damit der Typ `Uint8Array<ArrayBuffer>` ist -- ein Blob
    // nimmt keine Sicht auf einen geteilten Puffer an.
    const encoded = encoder.encode(value);
    const copy = new Uint8Array(new ArrayBuffer(encoded.length));
    copy.set(encoded);

    return copy;
  }

  async function read(blob: Blob): Promise<DataView> {
    return new DataView(await blob.arrayBuffer());
  }

  // Der Wert stammt aus zlib (`zlib.crc32(b'hallo welt')`). Eine eigene
  // Umsetzung der Prüfsumme ist nur so viel wert wie ihr Abgleich mit einer
  // fremden: Ein verdrehtes Polynom liefert stabile, aber falsche Werte, und
  // beim Auspacken heißt das „CRC-Fehler".
  it('rechnet dieselbe Prüfsumme wie zlib', () => {
    expect(crc32(bytes('hallo welt'))).toBe(0xbf47b89b);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('schreibt Datum und Zeit im DOS-Format', () => {
    const stamp = dosDateTime(new Date(2026, 8, 8, 12, 34, 56));

    expect(stamp.date).toBe(((2026 - 1980) << 9) | (9 << 5) | 8);
    expect(stamp.time).toBe((12 << 11) | (34 << 5) | 28);
  });

  // Vor 1980 gibt es im DOS-Format nicht. Ein negatives Jahresfeld liefe im
  // Kopfsatz über und machte das Archiv unbrauchbar -- wegen einer verstellten
  // Uhr.
  it('setzt Datumsangaben außerhalb der Reichweite auf den 1.1.1980', () => {
    const fallback = { time: 0, date: (1 << 5) | 1 };

    expect(dosDateTime(new Date(1970, 0, 1))).toEqual(fallback);
    expect(dosDateTime(new Date(NaN))).toEqual(fallback);
    // Nach oben ebenso: Ab 2108 läuft der 7-Bit-Jahresanteil über, und
    // `setUint16` schnitte ihn stillschweigend ab.
    expect(dosDateTime(new Date(2108, 0, 1))).toEqual(fallback);
    expect(dosDateTime(new Date(2107, 11, 31)).date).not.toEqual(fallback.date);
  });

  it('legt Kopfsätze, Verzeichnis und Abschlusssatz an', async () => {
    const first = bytes('hallo welt');
    const second = bytes('zweite datei');
    const blob = buildZip(
      [
        { name: 'a.txt', data: first },
        { name: 'unterordner/b.txt', data: second },
      ],
      new Date(2026, 8, 8, 12, 0, 0)
    );

    expect(blob.type).toBe('application/zip');

    const view = await read(blob);
    const size = view.byteLength;

    // Lokaler Kopfsatz des ersten Eintrags.
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0); // ohne Komprimierung
    expect(view.getUint32(14, true)).toBe(crc32(first));
    expect(view.getUint32(18, true)).toBe(first.length);
    expect(view.getUint32(22, true)).toBe(first.length);
    expect(view.getUint16(26, true)).toBe('a.txt'.length);

    // Abschlusssatz: zwei Einträge, und die Angaben zum Verzeichnis müssen auf
    // dessen tatsächliche Lage zeigen.
    const end = size - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 8, true)).toBe(2);
    expect(view.getUint16(end + 10, true)).toBe(2);

    const directorySize = view.getUint32(end + 12, true);
    const directoryOffset = view.getUint32(end + 16, true);
    expect(directoryOffset + directorySize).toBe(end);
    expect(view.getUint32(directoryOffset, true)).toBe(0x02014b50);

    // Der Abstand im Verzeichnis muss den lokalen Kopfsatz treffen, sonst
    // findet der Packer die Daten nicht.
    const secondEntry = directoryOffset + 46 + 'a.txt'.length;
    expect(view.getUint32(secondEntry, true)).toBe(0x02014b50);
    const localOffset = view.getUint32(secondEntry + 42, true);
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint32(localOffset + 14, true)).toBe(crc32(second));
  });

  // Angezeigt und ausgepackt wird der Name aus dem zentralen Verzeichnis. Ein
  // nur im lokalen Kopfsatz gesetztes UTF-8-Bit hilft dort nichts -- deshalb
  // wird es in BEIDEN geprüft.
  it('kennzeichnet die Namen in beiden Kopfsätzen als UTF-8', async () => {
    const view = await read(
      buildZip([{ name: 'ümläut.png', data: bytes('x') }])
    );

    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);

    const directoryOffset = view.getUint32(view.byteLength - 22 + 16, true);
    expect(view.getUint16(directoryOffset + 8, true) & 0x0800).toBe(0x0800);
  });

  // Das Verzeichnis trägt Prüfsumme und Größen ein zweites Mal. Stimmen sie
  // dort nicht, weisen Packer das Archiv mit „CRC-Fehler" ab oder packen leere
  // Dateien aus -- je nach Werkzeug, und ohne dass die Datei auffällig wäre.
  it('trägt Prüfsumme und Größen auch ins Verzeichnis ein', async () => {
    const data = bytes('hallo welt');
    const view = await read(buildZip([{ name: 'a.txt', data }]));
    const directoryOffset = view.getUint32(view.byteLength - 22 + 16, true);

    expect(view.getUint16(directoryOffset + 10, true)).toBe(0); // ohne Komprimierung
    expect(view.getUint32(directoryOffset + 16, true)).toBe(crc32(data));
    expect(view.getUint32(directoryOffset + 20, true)).toBe(data.length);
    expect(view.getUint32(directoryOffset + 24, true)).toBe(data.length);
  });

  // Zwei gleiche Namen ergeben ein gültiges Archiv, das beim Auspacken die
  // erste Datei überschreibt. Im Stapel eines Spieltags ist das der erreichbare
  // Fall: Zwei lange Vereinsnamen können sich auf 40 Zeichen gekürzt gleichen.
  it('weist zwei gleiche Namen ab', () => {
    expect(() =>
      buildZip([
        { name: 'a.png', data: bytes('x') },
        { name: 'a.png', data: bytes('y') },
      ])
    ).toThrowError(/Zwei Einträge/);
  });

  // Ein führender Schrägstrich oder ein `..` im Pfad ist der bekannte Weg, beim
  // Auspacken aus dem Zielordner auszubrechen.
  it('weist Namen ab, die aus dem Zielordner führen', () => {
    for (const name of [
      '/a.png',
      '../a.png',
      'ordner/../../a.png',
      'a\\b.png',
      '',
    ]) {
      expect(() => buildZip([{ name, data: bytes('x') }])).toThrowError(
        /Unzulässiger Name/
      );
    }
  });

  it('lässt Ordner im Namen zu', async () => {
    const view = await read(
      buildZip([{ name: 'spieltag-3/01-bild.png', data: bytes('x') }])
    );

    expect(view.getUint16(26, true)).toBe('spieltag-3/01-bild.png'.length);
  });

  // Der Zähler im Abschlusssatz ist 16 Bit breit. Ohne diesen Riegel entstünde
  // ein Archiv, dessen Einträge niemand zählen kann.
  it('weist mehr Einträge ab, als der Abschlusssatz zählen kann', () => {
    const data = bytes('x');
    const entries = Array.from({ length: 65536 }, (_unused, index) => ({
      name: `${index}.png`,
      data,
    }));

    expect(() => buildZip(entries)).toThrowError(/Zu viele Dateien/);
  });

  it('verpackt einen leeren Stapel zu einem leeren Archiv', async () => {
    const view = await read(buildZip([]));

    expect(view.byteLength).toBe(22);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(8, true)).toBe(0);
  });
});
