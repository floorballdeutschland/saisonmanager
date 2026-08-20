import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefereeService } from './referee.service';
import { environment } from 'src/environments/environment';

// Der Draht zu den drei neuen Admin-Endpunkten. Beide Suiten stubben sonst je
// ihre Seite weg: Die Komponenten-Specs ersetzen den Service, die API-Tests
// bauen den Upload selbst. Ein falscher Pfad oder ein falscher Feldname im
// FormData faellt damit nirgends auf und trifft erst die Produktion mit
// "CSV-Datei fehlt" oder einem 404.
describe('RefereeService – Konto-Werkzeuge', () => {
  let service: RefereeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
    });
    service = TestBed.inject(RefereeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('laedt die CSV als FormData-Feld "file" hoch', () => {
    const file = new File(
      ['Lizenznummer;E-Mailadresse\n4711;a@example.org\n'],
      'mails.csv',
      {
        type: 'text/csv',
      }
    );

    service.adminImportEmails(file).subscribe();

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/referees/import_emails`
    );
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect((body.get('file') as File).name).toBe('mails.csv');
    req.flush({
      total_rows: 1,
      updated: [],
      skipped: [],
      not_found: [],
      invalid: [],
    });
  });

  it('fragt die offene Anzahl per GET ab', () => {
    service.adminGetMissingUserCount().subscribe();

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/referees/missing_user_count`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ count: 3, batch_size: 100 });
  });

  it('loest die Massenanlage per POST aus', () => {
    service.adminCreateMissingUsers().subscribe();

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/referees/create_missing_users`
    );
    expect(req.request.method).toBe('POST');
    req.flush({
      requested: 0,
      created: [],
      failed: [],
      remaining: 0,
      batch_size: 100,
    });
  });
});
