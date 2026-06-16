import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmailTemplate, EmailTemplateUpdatePayload } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class EmailTemplateService {
  constructor(private http: HttpClient) {}

  public getAll() {
    return this.http.get<EmailTemplate[]>(
      environment.apiURL + 'admin/email_templates'
    );
  }

  public update(payload: EmailTemplateUpdatePayload) {
    return this.http.patch<EmailTemplate>(
      environment.apiURL + 'admin/email_templates',
      { email_template: payload }
    );
  }
}
