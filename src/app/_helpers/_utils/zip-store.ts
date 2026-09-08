/**
 * Schreibt ein ZIP-Archiv ohne Komprimierung (Methode „store“).
 *
 * WARUM VON HAND UND NICHT MIT EINER BIBLIOTHEK: Gepackt wird hier
 * ausschließlich, was schon gepackt IST -- PNG-Dateien. Ein Deflate-Durchlauf
 * darüber gewinnt nichts und ist der einzige Grund, warum man für ein ZIP sonst
 * eine Bibliothek nimmt. Übrig bleiben die Kopfsätze, und die sind weniger
 * Gewicht als eine Abhängigkeit im Bündel.
 *
 * WARUM ÜBERHAUPT EIN ARCHIV: Ein Spieltag hat regelmäßig ein halbes Dutzend
 * Spiele. Nacheinander ausgelöste Einzeldownloads beantwortet Chrome mit der
 * Rückfrage „Mehrere Dateien herunterladen?“, und wer sie abweist, hat genau
 * eine Datei und keinen Hinweis darauf, dass die anderen fehlen.
 *
 * GRENZEN: Kein ZIP64. Geprüft werden deshalb vier Dinge, und zwar mit einem
 * Wurf statt mit einem stillen Überlauf -- ein übergelaufener Kopfsatz erzeugt
 * ein Archiv, das vollständig aussieht und erst beim Auspacken auffällt:
 * höchstens 65.535 Einträge, Abstände unter 4 GB (geprüft wird der Abstand des
 * Verzeichnisses, nicht die Dateigröße auf dem Datenträger), ein Datum in der
 * Reichweite des DOS-Formats und Namen, die eindeutig und unverfänglich sind.
 */

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_DIRECTORY_SIZE = 22;

const MAX_ENTRIES = 0xffff;
const MAX_SIZE = 0xffffffff;

/**
 * Bit 11 im Flag-Feld: „der Dateiname ist UTF-8".
 *
 * Gesetzt wird es in BEIDEN Kopfsätzen, und das ist kein Fleiß: Angezeigt wird
 * der Name aus dem zentralen Verzeichnis, ein nur lokal gesetztes Bit hilft
 * dort also nichts. (Info-ZIP, das `unzip` auf macOS, entstellt Umlaute
 * trotzdem; Python, Windows und die Archivverwaltung von macOS lesen sie
 * richtig. Für die Thumbnails belanglos, weil `filenameSlug` reines ASCII
 * erzeugt -- aber `ZipEntry.name` nimmt beliebige Namen an.)
 */
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
/**
 * Fassung 2.0, im Verzeichnis zusätzlich als „version made by". Für „store"
 * genügte 1.0; 2.0 ist verbreiteter und schadet nicht.
 */
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
 * Die Auflösung beträgt zwei Sekunden, das Jahr zählt ab 1980 und reicht mit
 * sieben Bit bis 2107. Beide Grenzen zählen, und beide erreicht nur eine
 * verstellte Uhr: darunter wäre das Jahresfeld negativ, darüber liefe es über,
 * und `setUint16` schnitte es stillschweigend ab. Solche Datumsangaben werden
 * auf den 1.1.1980 gesetzt -- ein falsches Änderungsdatum ist harmlos, ein
 * falscher Kopfsatz nicht.
 */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = date.getFullYear();

  if (!Number.isFinite(date.getTime()) || year < 1980 || year > 2107) {
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
  const seen = new Set<string>();
  let offset = 0;
  let directorySize = 0;

  for (const entry of entries) {
    // Zwei gleiche Namen ergeben ein gültiges Archiv, das beim Auspacken die
    // erste Datei überschreibt -- dieselbe Klasse Fehler wie ein
    // übergelaufener Kopfsatz, nur die erreichbare. Ein führender
    // Schrägstrich, ein `..` oder ein Backslash im Pfad ist der bekannte Weg,
    // beim Auspacken aus dem Zielordner auszubrechen; ein Archiv von hier soll
    // das nie können.
    const segments = entry.name.split('/');
    if (
      entry.name.includes('\\') ||
      segments.includes('..') ||
      segments.includes('.') ||
      segments.some((segment) => !segment)
    ) {
      throw new Error(`Unzulässiger Name im Archiv: „${entry.name}".`);
    }
    if (seen.has(entry.name)) {
      throw new Error(`Zwei Einträge heißen „${entry.name}".`);
    }
    seen.add(entry.name);

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
