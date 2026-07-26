export type CsvCell = string | number | null | undefined;

// Serialisiert Kopfzeile + Datenzeilen als CSV: Semikolon als Trennzeichen und
// CRLF als Zeilenende, weil Excel in der deutschen Locale sonst alles in eine
// Spalte legt. Jede Zelle wird gequotet, enthaltene Anführungszeichen verdoppelt.
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')
    )
    .join('\r\n');
}

// Lädt die Zeilen als `<basename>-JJJJ-MM-TT.csv` herunter. Dem Inhalt wird ein
// UTF-8-BOM vorangestellt, damit Excel Umlaute korrekt darstellt.
export function downloadCsv(
  basename: string,
  headers: string[],
  rows: CsvCell[][]
): void {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  const blob = new Blob(['﻿' + toCsv(headers, rows)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${basename}-${yyyy}-${mm}-${dd}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}
