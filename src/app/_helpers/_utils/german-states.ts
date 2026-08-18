/**
 * Die 16 Bundeslaender mit ihrem ISO-Kuerzel, in der Reihenfolge, in der sie in
 * Auswahlfeldern stehen sollen (alphabetisch nach Name).
 *
 * Eine Quelle fuer beide Masken: den Sitz eines Vereins (`Club.state`) und den
 * Zustaendigkeitsbereich eines Landesverbands (`StateAssociation.states`). Die
 * Kuerzel muessen zu `ApplicationRecord.german_states` in der API passen, sonst
 * weist die Verbandsmaske ein gueltiges Bundesland als unbekannt ab.
 */
export const GERMAN_STATES: ReadonlyArray<{ name: string; isocode: string }> = [
  { name: 'Baden-Württemberg', isocode: 'de-bw' },
  { name: 'Bayern', isocode: 'de-by' },
  { name: 'Berlin', isocode: 'de-be' },
  { name: 'Brandenburg', isocode: 'de-bb' },
  { name: 'Bremen', isocode: 'de-hb' },
  { name: 'Hamburg', isocode: 'de-hh' },
  { name: 'Hessen', isocode: 'de-he' },
  { name: 'Mecklenburg-Vorpommern', isocode: 'de-mv' },
  { name: 'Niedersachsen', isocode: 'de-ni' },
  { name: 'Nordrhein-Westfalen', isocode: 'de-nw' },
  { name: 'Rheinland-Pfalz', isocode: 'de-rp' },
  { name: 'Saarland', isocode: 'de-sl' },
  { name: 'Sachsen', isocode: 'de-sn' },
  { name: 'Sachsen-Anhalt', isocode: 'de-st' },
  { name: 'Schleswig-Holstein', isocode: 'de-sh' },
  { name: 'Thüringen', isocode: 'de-th' },
];

/**
 * Auswahl fuer den Vereinssitz: die 16 Bundeslaender plus „Sonstige" fuer
 * Vereine mit Sitz im Ausland.
 *
 * Ein Zustaendigkeitsbereich „Sonstige" ergibt dagegen keinen Sinn, deshalb
 * bleibt der Eintrag hier und nicht in GERMAN_STATES. Die API weist ihn am
 * Landesverband auch ab.
 */
export const CLUB_STATE_OPTIONS: ReadonlyArray<{
  name: string;
  isocode: string;
}> = [...GERMAN_STATES, { name: 'Sonstige', isocode: 'de-sonstige' }];

/** Klartextname zu einem Kuerzel, oder das Kuerzel selbst, wenn unbekannt. */
export function germanStateName(isocode: string): string {
  return (
    CLUB_STATE_OPTIONS.find((s) => s.isocode === isocode)?.name ?? isocode
  );
}
