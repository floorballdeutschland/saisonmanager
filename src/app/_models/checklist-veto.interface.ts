export interface ChecklistVetoItem {
  id: number;
  question: string;
}

export interface ChecklistVetoAnswer {
  item_id: number;
  question: string;
  answer: boolean;
}

/**
 * Einspruch des Ausrichtervereins gegen die von der Spielleitung beantwortete
 * Spieltagscheckliste. Erreichbar ausschließlich über den Einmal-Token aus der
 * Bestätigungsmail, ohne Benutzerkonto.
 *
 * `original_answers` sind die Antworten der Spielleitung; sie werden dem
 * Ausrichter als Ausgangsstand angezeigt, damit er sieht, wogegen er Einspruch
 * einlegt.
 */
export interface ChecklistVeto {
  already_submitted: boolean;
  submitted_at?: string;
  game_number?: string;
  home_team_name?: string;
  guest_team_name?: string;
  date?: string;
  original_answers: ChecklistVetoAnswer[];
  checklist_items: ChecklistVetoItem[];
}
