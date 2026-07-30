// Erlaubte Bildformate für Logo- und Banner-Uploads.
//
// Muss mit LOGO_ALLOWED_CONTENT_TYPES der API übereinstimmen
// (app/controllers/application_controller.rb). SVG ist dort bewusst
// ausgeschlossen, weil ActiveStorage es als Attachment ausliefert und ein
// unbereinigtes SVG bei Inline-Auslieferung ein XSS-Vektor wäre.
export const IMAGE_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Für das accept-Attribut eines <input type="file">.
export const IMAGE_UPLOAD_ACCEPT = IMAGE_UPLOAD_TYPES.join(',');

export function isAllowedImageType(file: File): boolean {
  return IMAGE_UPLOAD_TYPES.includes(file.type);
}
