import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { RefereeCourseImportService } from './referee-course-import.service';

// Der Body entscheidet, wie viel eingereicht wird: Ohne `result_ids` reicht die
// API alle offenen Zeilen ein, und eine angewendete Lizenz lässt sich nicht
// zurücknehmen. Ein Klick auf eine Zeile darf nie zu „alle" werden.
describe('RefereeCourseImportService#submitImport', () => {
  let service: RefereeCourseImportService;
  let http: HttpTestingController;
  const URL = environment.apiURL + 'admin/referee_course_imports/9/submit';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RefereeCourseImportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('schickt die gewählten Zeilen als result_ids', () => {
    service.submitImport(9, [2]).subscribe();

    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ result_ids: [2] });
    req.flush({});
  });

  it('schickt ohne Auswahl einen leeren Body (alle offenen Zeilen)', () => {
    service.submitImport(9).subscribe();

    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});
