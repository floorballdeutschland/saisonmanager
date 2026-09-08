/**
 * Schreibt ein ZIP-Archiv ohne Komprimierung (Methode „store“).
 *
 * WARUM VON HAND UND NICHT MIT EINER BIBLIOTHEK: Gepackt wird hier
 * ausschließlich, was schon gepackt IST -- PNG-Dateien. Ein Deflate-Durchlauf
 * darüber gewinnt nichts und ist der einzige Grund, warum man für ein ZIP sonst
 * eine Bibliothek nimmt. Übrig bleiben knapp hundert Zeilen Kopfsätze, und die
 * sind weniger Gewicht als eine Abhängigkeit im Bündel.
 *
 * WARUM ÜBERHAUPT EIN ARCHIV: Ein Spieltag hat regelmäßig ein halbes Dutzend
 * Spiele. Nacheinander ausgelöste Einzeldownloads beantwortet Chrome mit der
 * Rückfrage „Mehrere Dateien herunterladen?“, und wer sie abweist, hat genau
 * eine Datei und keinen Hinweis darauf, dass die anderen fehlen.
 *
 * GRENZEN: Kein ZIP64. Das Archiv darf also weder 4 GB noch 65.535 Einträge
 * überschreiten -- bei Thumbnails von je einigen hundert Kilobyte liegen beide
 * Grenzen außer Reichweite, aber sie werden geprüft statt still überschritten:
 * Ein überlaufener Kopfsatz erzeugt ein Archiv, das erst beim Auspacken auffällt.
 */

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_DIRECTORY_SIZE = 22;

const MAX_ENTRIES = 0xffff;
const MAX_SIZE = 0xffffffff;

/** Dateiname im Archiv, mit UTF-8-Kennzeichnung (Flag-Bit 11). */
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
/** Fassung 2.0. Für „store“ genügte 1.0; 2.0 ist der Wert, den alle Packer schreiben. */
const VERSION = 20;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;

  for (let index = 0; index < data.length; index++) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Zeitstempel im MS-DOS-Format, das ein ZIP je Eintrag trägt.
 *
 * Die Auflösung beträgt zwei Sekunden, und das Jahr zählt ab 1980: Ein Rechner
 * mit verstellter Uhr vor 1980 ergäbe ein negatives Feld und damit einen
 * kaputten Kopfsatz. Solche Datumsangaben werden auf den 1.1.1980 gesetzt --
 * ein falsches Änderungsdatum ist harmlos, ein falscher Kopfsatz nicht.
 */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = date.getFullYear();

  if (!Number.isFinite(date.getTime()) || year < 1980) {
    return { time: 0, date: (1 << 5) | 1 };
  }

  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export interface ZipEntry {
  /** Pfad im Archiv. Ordner werden mit `/` getrennt. */
  name: string;
  /**
   * Der Inhalt. `Uint8Array<ArrayBuffer>` und nicht bloß `Uint8Array`: Ein
   * `Blob` nimmt nur Sichten auf einen gewöhnlichen Puffer an, nicht auf einen
   * geteilten (`SharedArrayBuffer`), und seit TypeScript 5.7 steht dieser
   * Unterschied im Typ. Wer aus `arrayBuffer()` liest, hat den engeren Typ
   * ohnehin.
   */
  data: Uint8Array<ArrayBuffer>;
}

/**
 * Baut das Archiv als Blob.
 *
 * Aufbau: je Eintrag ein lokaler Kopfsatz samt Daten, danach das zentrale
 * Verzeichnis mit denselben Angaben und dem Abstand des lokalen Kopfsatzes vom
 * Dateianfang, zum Schluss der Abschlusssatz. Auspacken tun alle Werkzeuge über
 * das zentrale Verzeichnis; stimmen die Abstände dort nicht, ist das Archiv
 * unbrauchbar, ohne dass die Datei kleiner oder auffällig wäre.
 */
export function buildZip(entries: ZipEntry[], modified = new Date()): Blob {
  if (entries.length > MAX_ENTRIES) {
    throw new Error('Zu viele Dateien für ein Archiv ohne ZIP64.');
  }

  const encoder = new TextEncoder();
  const stamp = dosDateTime(modified);
  const parts: BlobPart[] = [];
  const directory: BlobPart[] = [];
  let offset = 0;
  let directorySize = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const size = entry.data.length;
    const crc = crc32(entry.data);

    const local = new DataView(new ArrayBuffer(LOCAL_HEADER_SIZE));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, VERSION, true);
    local.setUint16(6, FLAG_UTF8, true);
    local.setUint16(8, METHOD_STORE, true);
    local.setUint16(10, stamp.time, true);
    local.setUint16(12, stamp.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, name, entry.data);

    const central = new DataView(new ArrayBuffer(CENTRAL_HEADER_SIZE));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, VERSION, true);
    central.setUint16(6, VERSION, true);
    central.setUint16(8, FLAG_UTF8, true);
    central.setUint16(10, METHOD_STORE, true);
    central.setUint16(12, stamp.time, true);
    central.setUint16(14, stamp.date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, name.length, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, offset, true);
    directory.push(central.buffer, name);

    offset += LOCAL_HEADER_SIZE + name.length + size;
    directorySize += CENTRAL_HEADER_SIZE + name.length;

    if (offset > MAX_SIZE) {
      throw new Error('Das Archiv wäre größer als 4 GB (kein ZIP64).');
    }
  }

  const end = new DataView(new ArrayBuffer(END_OF_DIRECTORY_SIZE));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);

  return new Blob([...parts, ...directory, end.buffer], {
    type: 'application/zip',
  });
}
