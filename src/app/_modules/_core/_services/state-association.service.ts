import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ChecklistItem,
  GameOperation,
  StateAssociation,
  StateAssociationRelease,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StateAssociationService {
  constructor(private http: HttpClient) {}

  public getAll() {
    return this.http.get<StateAssociation[]>(
      environment.apiURL + 'state_associations'
    );
  }

  public adminGetAll() {
    return this.http.get<StateAssociation[]>(
      environment.apiURL + 'admin/state_associations'
    );
  }

  public adminGet(id: number) {
    return this.http.get<StateAssociation>(
      environment.apiURL + 'admin/state_associations/' + id
    );
  }

  public adminCreate(sa: Partial<StateAssociation>) {
    return this.http.post<StateAssociation>(
      environment.apiURL + 'admin/state_associations',
      { state_association: sa }
    );
  }

  public adminUpdate(id: number, sa: Partial<StateAssociation>) {
    return this.http.put<StateAssociation>(
      environment.apiURL + 'admin/state_associations/' + id,
      { state_association: sa }
    );
  }

  public adminDelete(id: number) {
    return this.http.delete(
      environment.apiURL + 'admin/state_associations/' + id
    );
  }

  public adminCreateChecklistItem(
    stateAssociationId: number,
    item: Partial<ChecklistItem>
  ) {
    return this.http.post<ChecklistItem>(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/checklist_items`,
      { checklist_item: item }
    );
  }

  public adminUpdateChecklistItem(
    stateAssociationId: number,
    itemId: number,
    item: Partial<ChecklistItem>
  ) {
    return this.http.put<ChecklistItem>(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/checklist_items/${itemId}`,
      { checklist_item: item }
    );
  }

  public adminDeleteChecklistItem(stateAssociationId: number, itemId: number) {
    return this.http.delete(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/checklist_items/${itemId}`
    );
  }

  // Mögliche Empfänger-Sportverbünde für eine Freigabe (alle außer den eigenen
  // des Landesverbands). Siehe releases#candidates im API.
  public adminGetReleaseCandidates(stateAssociationId: number) {
    return this.http.get<GameOperation[]>(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/releases/candidates`
    );
  }

  public adminCreateRelease(
    stateAssociationId: number,
    recipientGameOperationId: number
  ) {
    return this.http.post<StateAssociationRelease>(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/releases`,
      { recipient_game_operation_id: recipientGameOperationId }
    );
  }

  public adminDeleteRelease(stateAssociationId: number, releaseId: number) {
    return this.http.delete(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/releases/${releaseId}`
    );
  }

  public adminUploadLogo(stateAssociationId: number, file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<{ logo_url: string }>(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/upload_logo.json`,
      formData
    );
  }

  public adminUploadBanner(stateAssociationId: number, file: File) {
    const formData = new FormData();
    formData.append('banner', file);
    return this.http.post<{ banner_url: string }>(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/upload_banner.json`,
      formData
    );
  }

  public adminDeleteBanner(stateAssociationId: number) {
    return this.http.delete(
      `${environment.apiURL}admin/state_associations/${stateAssociationId}/banner.json`
    );
  }
}
