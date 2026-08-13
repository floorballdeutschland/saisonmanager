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
  referee_license_review_enabled?: boolean;
  effective_referee_license_review_enabled?: boolean;
  // Tatsaechlich greifende Werte inklusive Vererbung vom uebergeordneten
  // Verbund. Nur im Detail-Endpunkt enthalten, nicht in der Liste (short_hash),
  // deshalb optional.
  effective_express_license_enabled?: boolean;
  effective_vsk_email?: string | null;
  effective_sbk_email?: string | null;
  effective_rsk_email?: string | null;
  manual_proceeding_creation?: boolean;
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
