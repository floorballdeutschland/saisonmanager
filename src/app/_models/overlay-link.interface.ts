/**
 * Zustand des Overlay-Zugangs eines Spieltags (GameDayOverlayLink).
 *
 * Bewusst ohne Token: Der Klartext existiert einmalig in der Antwort auf das
 * Erzeugen, gespeichert ist serverseitig nur sein Digest. Jede spätere Auskunft
 * kann deshalb nur sagen, ob ein Zugang läuft, bis wann und von wem.
 */
export interface OverlayLinkState {
  active: boolean;
  expires_at?: string | null;
  created_by?: string | null;
}
