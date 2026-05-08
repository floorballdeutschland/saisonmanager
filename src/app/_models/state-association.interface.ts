export interface ChecklistItem {
  id: number;
  question: string;
  position: number;
}

export interface StateAssociation {
  id: number;
  name: string;
  short_name?: string;
  vsk_email?: string;
  sbk_email?: string;
  express_license_enabled?: boolean;
  require_paper_game_report?: boolean;
  checklist_items?: ChecklistItem[];
}
