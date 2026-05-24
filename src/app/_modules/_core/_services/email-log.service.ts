import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmailLog } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class EmailLogService {
  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<EmailLog[]>(environment.apiURL + 'admin/email_logs');
  }

  sendTest(recipient: string) {
    return this.http.post<{ ok: boolean }>(
      environment.apiURL + 'admin/email_logs/send_test',
      { recipient }
    );
  }
}
