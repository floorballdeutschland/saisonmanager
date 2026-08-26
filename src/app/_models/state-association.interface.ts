import { GermanStateCode } from 'src/app/_helpers/_utils/german-states';

export interface ChecklistItem {
  id: number;
  question: string;
  position: number;
}

export interface StateAssociationRelease {
  id: number;
  recipient_game_operation_id: number;
  recipient_game_operation_name: string;
}

export interface StateAssociation {
  id: number;
  name: string;
  short_name?: string;
  parent_id?: number | null;
  parent_name?: string | null;
  vsk_email?: string | null;
  sbk_email?: string | null;
  // Postfach der Schiedsrichteransetzung; erbt ohne eigenen Eintrag vom
  // uebergeordneten Verband.
  rsk_email?: string | null;
  express_license_enabled?: boolean;
  scan_required?: boolean;
  // Bundeslaender im Zustaendigkeitsbereich, als ISO-Kuerzel (z.B. 'de-nw').
  // Nur die Administration pflegt sie: daran soll kuenftig haengen, wer einen
  // Spielort zusammenfuehren, loeschen und abschalten darf.
  states?: GermanStateCode[];
  // Der tatsaechlich greifende Bereich einschliesslich der untergeordneten
  // Verbaende. Die Vererbung laeuft hier nach unten, anders als bei allen
  // effective_*-Feldern darunter: ein uebergeordneter Spielverbund erbt den
  // Bereich seiner Kinder, statt selbst etwas einzutragen.
  effective_states?: GermanStateCode[];
  referee_license_review_enabled?: boolean;
  // Tatsaechlich greifende Werte inklusive Vererbung vom uebergeordneten
  // Verbund. Nur im Detail-Endpunkt enthalten, nicht in der Liste (short_hash),
  // deshalb optional.
  //
  // Einstellungen und Postfaecher erben unterschiedlich: Haengt ein Verbund
  // dran, kommt der ganze Block „Einstellungen" von dort (die Felder unten sind
  // dann nur noch Ueberbleibsel und werden weder angezeigt noch gesendet), die
  // Postfaecher dagegen sind ein Rueckfall und weichen einem eigenen Eintrag.
  effective_express_license_enabled?: boolean;
  effective_referee_license_review_enabled?: boolean;
  effective_scan_required?: boolean;
  effective_referee_assignment_external_enabled?: boolean;
  effective_referee_assignment_enabled?: boolean;
  effective_person_level_assignment_default?: boolean;
  effective_report_form_email_enabled?: boolean;
  effective_manual_proceeding_creation?: boolean;
  effective_requested_license_playable?: boolean;
  effective_vsk_email?: string | null;
  effective_sbk_email?: string | null;
  effective_rsk_email?: string | null;
  manual_proceeding_creation?: boolean;
  // Laesst Personen mit dem Lizenzstatus „beantragt" im Spielbetrieb dieses
  // Verbands aufstellen. Gelesen wird der Wert nicht hier, sondern am Spiel
  // (Game#requested_license_playable): Zustaendig ist der Verband der Liga.
  requested_license_playable?: boolean;
  // Drei gestaffelte Ansetzungs-Optionen: der Hauptschalter erlaubt die
  // Ansetzung ausserhalb der SBK, referee_assignment_enabled hebt sie auf die
  // Personenebene (Rolle Ansetzer*in), die Voreinstellung markiert neue Spiele
  // gleich dafuer. Jede setzt die darueberliegende voraus.
  referee_assignment_external_enabled?: boolean;
  referee_assignment_enabled?: boolean;
  person_level_assignment_default?: boolean;
  report_form_email_enabled?: boolean;
  logo_url?: string | null;
  banner_url?: string | null;
  banner_link_url?: string | null;
  children?: Array<
    Pick<StateAssociation, 'id' | 'name' | 'short_name' | 'logo_url'>
  >;
  checklist_items?: ChecklistItem[];
  releases?: StateAssociationRelease[];
}
