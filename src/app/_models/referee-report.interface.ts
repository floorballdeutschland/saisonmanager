// Wohin ein hochgeladenes Berichtsformular geht (api#789): volle Matchstrafe
// an die VSK, technische Matchstrafe und besonderes Ereignis an die SBK, im
// Mischfall an beide. Im manuellen Modus des Landesverbands immer die SBK.
export type RefereeReportRecipient = 'vsk' | 'sbk' | 'vsk_and_sbk';

export interface RefereeReportStatus {
  uploaded: boolean;
  // Ist ein Bericht verlangt? Nur für Admin, SBK und angesetzte Schiris
  // gesetzt, für alle anderen false.
  required?: boolean;
  recipient?: RefereeReportRecipient | null;
  filename?: string;
  content_type?: string;
  uploaded_at?: string;
  url?: string;
}
