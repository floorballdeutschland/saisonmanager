// Uploadzeitpunkt einer Dokumentart aus der documents-Map der API.
//
// Gemeinsam für die drei Lizenzansichten, die sich nur darin unterscheiden, wo
// die Map hängt: in der Verbandsliste am Eintrag, in Liga-Detail und
// Genehmigungsdialog unter team_license. Der Riegel muss damit nur an einer
// Stelle stimmen.
//
// Zwei Prüfungen, beide nötig:
//
//   - typeof string, weil die Map über ihre Index-Signatur auch boolesche Werte
//     trägt (unter <key> steht einer). Ein solcher Wert in der date-Pipe wirft.
//   - Date.parse, weil eine Zeichenkette noch kein lesbares Datum ist. Die Pipe
//     wirft auch dafür, und zwar mitten in der Change Detection: Die ganze
//     Übersicht rendert dann nicht mehr, nicht nur diese eine Zelle.
//
// Fehlt das Feld (ältere Serverantwort), bleibt es bei null und die Ansicht
// zeigt wie bisher nur Symbol beziehungsweise Label.
export function readUploadedAt(
  documents:
    | Record<string, boolean | string | null | undefined>
    | null
    | undefined,
  docType: string
): string | null {
  const value = documents?.[docType + '_uploaded_at'];
  if (typeof value !== 'string') return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}
