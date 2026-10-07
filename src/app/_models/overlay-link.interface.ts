/**
 * Zustand des Overlay-Zugangs eines Spieltags (GameDayOverlayLink).
 *
 * Bewusst ohne Token: Der Klartext existiert einmalig in der Antwort auf das
 * Erzeugen, gespeichert ist serverseitig nur sein Digest. Jede spätere Auskunft
 * kann deshalb nur sagen, ob ein Zugang läuft, bis wann und von wem.
 */
export interface OverlayLinkState {
  active: boolean;
  /**
   * Beginn des Gültigkeitsfensters (72 Stunden vor dem Spieltag). Fehlt bei
   * einer API vor dem Fenster und bei Altbestand, der ab Ausgabe gilt.
   */
  valid_from?: string | null;
  expires_at?: string | null;
  created_by?: string | null;
}
