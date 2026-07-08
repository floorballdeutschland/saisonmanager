import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { DocumentType } from '@floorball/types';
import { environment } from 'src/environments/environment';

// Dokumentarten-Katalog (admin/SBK) – zentrale Pflege der Lizenz-
// Pflichtdokumente inkl. optionaler Vorlage (Datei), daher FormData.
@Injectable({
  providedIn: 'root',
})
export class DocumentTypeService {
  constructor(private http: HttpClient) {}

  public adminGetDocumentTypes() {
    return this.http.get<DocumentType[]>(
      environment.apiURL + 'admin/document_types'
    );
  }

  public adminCreateDocumentType(data: Partial<DocumentType>, template?: File) {
    return this.http.post<DocumentType>(
      environment.apiURL + 'admin/document_types',
      this._buildFormData(data, template)
    );
  }

  public adminUpdateDocumentType(
    id: number,
    data: Partial<DocumentType>,
    template?: File,
    removeTemplate?: boolean
  ) {
    const formData = this._buildFormData(data, template);
    if (removeTemplate) {
      formData.append('remove_template', '1');
    }
    return this.http.patch<DocumentType>(
      environment.apiURL + 'admin/document_types/' + id,
      formData
    );
  }

  public adminDeleteDocumentType(id: number) {
    return this.http.delete(environment.apiURL + 'admin/document_types/' + id);
  }

  private _buildFormData(
    data: Partial<DocumentType>,
    template?: File
  ): FormData {
    const formData = new FormData();
    const fields = [
      'name',
      'description',
      'game_operation_id',
      'validity',
      'required_below_age',
    ] as const;
    fields.forEach((field) => {
      const value = data[field];
      if (value === undefined) return;
      formData.append(
        `document_type[${field}]`,
        value === null ? '' : String(value)
      );
    });
    if (template) {
      formData.append('document_type[template]', template);
    }
    return formData;
  }
}
