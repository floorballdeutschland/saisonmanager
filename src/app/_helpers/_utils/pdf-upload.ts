// Spieldokumente (Scan des Spielberichtsbogens, Berichtsformular der
// Schiedsrichter) nimmt die API nur noch als PDF an (PdfOnlyAttachment in
// der API). Fotos ließen sich in der Browseransicht nicht drehen.
//
// Die Prüfung hier erspart nur den vergeblichen Upload, maßgeblich bleibt die
// API. Beide lesen dafür die PDF-Kennung im Dateikopf, siehe checkPdfUpload.
export const PDF_UPLOAD_TYPE = 'application/pdf';

// Für das accept-Attribut eines <input type="file">. Die Endung steht mit
// drin, weil manche Dateiauswahl-Dialoge (Android) sonst alles anbieten.
export const PDF_UPLOAD_ACCEPT = `${PDF_UPLOAD_TYPE},.pdf`;

// Dieselbe Grenze wie MAX_FILE_SIZE an GameScan und GameRefereeReport in der
// API.
export const PDF_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const PDF_UPLOAD_MAX_MB = PDF_UPLOAD_MAX_BYTES / (1024 * 1024);

// Falscher Typ und zu große Datei bekommen dieselbe Meldung, wie in der API
// (PdfOnlyAttachment.pdf_only_message): Wer daneben greift, soll lesen, was
// zulässig ist.
export const PDF_UPLOAD_REJECTED_MESSAGE = `Nur PDF-Dateien bis ${PDF_UPLOAD_MAX_MB} MB sind zulässig, Fotos werden nicht angenommen.`;

// Wie in der API (PdfOnlyAttachment): Die Kennung darf hinter etwas Vorspann
// stehen, gesucht wird in den ersten 1024 Bytes.
const PDF_SIGNATURE = '%PDF-';
const PDF_SIGNATURE_WINDOW = 1024;

// Nur eine Vorauswahl nach dem, was der Browser angibt. `File.type` leitet
// der Browser aus der Endung ab, nicht aus dem Inhalt: Ein in `.pdf`
// umbenanntes Foto kommt hier als application/pdf an und passiert. Das fängt
// erst die Kennung in checkPdfUpload ab. Ohne Typangabe (manche Browser
// liefern bei unbekannter Zuordnung einen leeren `type`) entscheidet die
// Endung.
export function isPdfFile(file: File): boolean {
  if (file.type) return file.type === PDF_UPLOAD_TYPE;
  return file.name.toLowerCase().endsWith('.pdf');
}

export function isAcceptablePdfUpload(file: File): boolean {
  return isPdfFile(file) && file.size <= PDF_UPLOAD_MAX_BYTES;
}

export async function hasPdfSignature(file: File): Promise<boolean> {
  try {
    const head = await file.slice(0, PDF_SIGNATURE_WINDOW).arrayBuffer();
    return new TextDecoder('latin1').decode(head).includes(PDF_SIGNATURE);
  } catch {
    // Lässt sich die Datei nicht lesen, entscheidet die API.
    return true;
  }
}

// Vollständige Vorprüfung vor dem Upload: Typ, Größe und Kennung im
// Dateikopf.
export async function checkPdfUpload(file: File): Promise<boolean> {
  return isAcceptablePdfUpload(file) && (await hasPdfSignature(file));
}
