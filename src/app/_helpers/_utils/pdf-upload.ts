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

// Ohne Typangabe (manche Browser liefern bei unbekannter Zuordnung einen
// leeren `type`) entscheidet die Endung. Ist ein Typ angegeben, gilt er: ein
// in `.pdf` umbenanntes Foto meldet der Browser weiter als Bild.
export function isPdfFile(file: File): boolean {
  if (file.type) return file.type === PDF_UPLOAD_TYPE;
  return file.name.toLowerCase().endsWith('.pdf');
}
