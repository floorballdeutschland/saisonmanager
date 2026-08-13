// Redaktionell gepflegter Link auf ein externes Informationsblatt
// (floorball.de). `key` ist der stabile technische Bezeichner, über den das
// Frontend den Link an seiner Stelle einsetzt; die Adresse wechselt, sobald
// floorball.de die Datei neu ablegt, und wird unter /verwaltung/dokumentarten
// gepflegt. `url` ist null, solange nichts hinterlegt ist – der Link wird dann
// nicht angeboten.
export interface InfoLink {
  key: string;
  url: string | null;
}

// Bekannte Keys. Die API kennt dieselbe Liste (Setting::INFO_LINK_KEYS) und
// weist unbekannte Keys ab; neue Keys brauchen beide Seiten.
export const INFO_LINK_MINOR_PRIVACY_BUNDESLIGA = 'minor_privacy_bundesliga';
