/**
 * Fassung der Nutzungsvereinbarung, wie sie auf der Volltext-Seite steht.
 *
 * Nur zur Anzeige („Fassung vom …"). Was der Antrag festhält, ist die Fassung,
 * die das Formular beim Laden über GET api_terms_version geholt hat
 * (ApiTerms::VERSION); der Server weist die Zustimmung ab, wenn sie
 * zwischenzeitlich veraltet ist, etwa bei einem lange offenen Tab.
 *
 * Diese Konstante sieht der Server nie. Weicht sie vom Text daneben ab, fällt
 * das nirgends auf, deshalb bei einer Textänderung immer beide Stellen ziehen.
 */
export const API_TERMS_VERSION = '2026-08-06';

/**
 * Standardgrenze eines beantragten Zugangs in Anfragen pro Minute (§ 6.1).
 *
 * Anzeigewert. Durchgesetzt wird die Grenze in der API
 * (ApiTerms::RATE_LIMIT_PER_MINUTE, gesetzt beim Abholen des Keys); wird sie
 * dort geändert, gehört sie hier mitgezogen, sonst verspricht der Vertragstext
 * etwas anderes als der Zugang kann.
 */
export const API_RATE_LIMIT_PER_MINUTE = 60;

/**
 * Richtwert für das Tagesvolumen (§ 6.2), entspricht
 * ApiTerms::DAILY_REQUEST_GUIDELINE. Anders als das Minutenlimit wird er nicht
 * technisch erzwungen.
 */
export const API_DAILY_REQUEST_GUIDELINE = 10000;
