export interface ChecklistItem {
  id: number;
  question: string;
  position: number;
}

export interface StateAssociation {
  id: number;
  name: string;
  short_name?: string;
  parent_id?: number | null;
  vsk_email?: string | null;
  sbk_email?: string | null;
  express_license_enabled?: boolean;
  require_paper_game_report?: boolean;
  scan_required?: boolean;
  children?: Array<Pick<StateAssociation, 'id' | 'name' | 'short_name'>>;
  checklist_items?: ChecklistItem[];
}
