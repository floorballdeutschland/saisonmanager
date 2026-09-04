/**
 * Ausscheidungswettbewerbe: Turnierbaum statt Tabelle.
 *
 * Für die Anzeige zählt, dass ein Playoff im K.-o.-System läuft. Für das
 * Wettbewerbszeichen zählt das Gegenteil: Das Playoff der 1. Bundesliga trägt
 * deren Wortmarke und nicht die des Pokals, deshalb behandelt
 * competition-theme.ts `playoff` NICHT wie `cup`.
 */
const KNOCKOUT_TYPES = new Set<string>(['cup', 'playoff']);

/**
 * Läuft die Liga im K.-o.-System?
 *
 * Bewusst als Funktion und nicht als Vergleich an jeder Fundstelle: Vor
 * api#603 stand überall `league_type === 'cup'`, und beim neuen Wert wäre jede
 * dieser Stellen einzeln zu suchen gewesen.
 */
export function isKnockout(
  league?: { league_type?: string | null } | null
): boolean {
  return KNOCKOUT_TYPES.has(String(league?.league_type ?? ''));
}
