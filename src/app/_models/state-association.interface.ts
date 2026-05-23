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
  vsk_email?: string | null;
  sbk_email?: string | null;
  express_license_enabled?: boolean;
  scan_required?: boolean;
  logo_url?: string | null;
  banner_url?: string | null;
  banner_link_url?: string | null;
  children?: Array<
    Pick<StateAssociation, 'id' | 'name' | 'short_name' | 'logo_url'>
  >;
  checklist_items?: ChecklistItem[];
  releases?: StateAssociationRelease[];
}
