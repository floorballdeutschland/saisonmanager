import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';

import { SystemHealthService } from './system-health.service';

// Der Kontrakt zur API, den die Komponenten-Spec nicht abdecken kann: Dort
// stehen Spies, hier steht der tatsächlich abgesetzte Request. Ohne diese Tests
// bleibt eine Umbenennung des Wrappers `blocked_ip` auf beiden Seiten grün und
// erzeugt in Produktion einen 400.
describe('SystemHealthService', () => {
  let service: SystemHealthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(SystemHealthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('holt die Sperrliste vom Admin-Endpunkt', () => {
    service.getBlockedIps().subscribe();

    const req = httpMock.expectOne(environment.apiURL + 'admin/blocked_ips');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // Der Controller verlangt params.require(:blocked_ip) — der Wrapper ist Teil
  // des Kontrakts, nicht Kosmetik.
  it('schickt Adresse und Grund im blocked_ip-Wrapper', () => {
    service.createBlockedIp('198.51.100.5', 'Dauerhaft 401').subscribe();

    const req = httpMock.expectOne(environment.apiURL + 'admin/blocked_ips');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      blocked_ip: { ip: '198.51.100.5', reason: 'Dauerhaft 401' },
    });
    req.flush({});
  });

  it('löscht über die id in der Adresse', () => {
    service.deleteBlockedIp(7).subscribe();

    const req = httpMock.expectOne(environment.apiURL + 'admin/blocked_ips/7');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
