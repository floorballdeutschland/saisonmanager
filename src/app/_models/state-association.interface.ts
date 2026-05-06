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
  checklist_items?: ChecklistItem[];
}
