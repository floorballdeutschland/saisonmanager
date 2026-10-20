// Spieldokumente (Scan des Spielberichtsbogens, Berichtsformular der
// Schiedsrichter) nimmt die API nur noch als PDF an (PdfOnlyAttachment in
// der API). Fotos ließen sich in der Browseransicht nicht drehen.
//
// Die Prüfung hier erspart nur den vergeblichen Upload, maßgeblich bleibt die
// API, die zusätzlich die PDF-Kennung im Dateikopf liest.
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

// Ohne Typangabe (manche Browser liefern bei unbekannter Zuordnung einen
// leeren `type`) entscheidet die Endung. Ist ein Typ angegeben, gilt er: ein
// in `.pdf` umbenanntes Foto meldet der Browser weiter als Bild.
export function isPdfFile(file: File): boolean {
  if (file.type) return file.type === PDF_UPLOAD_TYPE;
  return file.name.toLowerCase().endsWith('.pdf');
}

export function isAcceptablePdfUpload(file: File): boolean {
  return isPdfFile(file) && file.size <= PDF_UPLOAD_MAX_BYTES;
}
