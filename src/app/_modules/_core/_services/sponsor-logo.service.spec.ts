import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { SponsorLogoService } from './sponsor-logo.service';

// Ein Dienst mit Bereichs-Parameter statt zweier fast gleicher Dienste ist
// richtig -- aber damit haengt beide Ebenen an EINEM Pfadaufbau. Faellt der
// falsch aus, gibt es keinen Fehler zu sehen: Die Komponente verschluckt den
// Listen-Fehler absichtlich und zeigt eine leere Liste. Ein falscher Pfad sieht
// also genauso aus wie "noch keine Partnerlogos hinterlegt".
describe('SponsorLogoService', () => {
  let service: SponsorLogoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SponsorLogoService],
    });
    service = TestBed.inject(SponsorLogoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Genau die Pfade aus config/routes.rb in api#377.
  it('spricht fuer Ligen den Ligapfad an', () => {
    service.list('leagues', 42).subscribe();

    const req = http.expectOne(
      `${environment.apiURL}admin/leagues/42/sponsor_logos`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ sponsor_logos: [] });
  });

  it('spricht fuer Vereine den Vereinspfad an', () => {
    service.list('clubs', 7).subscribe();

    const req = http.expectOne(
      `${environment.apiURL}admin/clubs/7/sponsor_logos`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ sponsor_logos: [] });
  });

  // Der Server liest `params[:sponsor_logo]`. Ein anderer Feldname waere ein
  // 422 "Kein Bild angefuegt", und die Komponente zeigte nur die Servermeldung.
  it('haengt die Datei unter dem Feldnamen an, den der Server liest', () => {
    const file = new File(['x'], 'partner.png', { type: 'image/png' });
    service.upload('clubs', 7, file).subscribe();

    const req = http.expectOne(
      `${environment.apiURL}admin/clubs/7/sponsor_logos`
    );
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect((body.get('sponsor_logo') as File).name).toBe('partner.png');
    req.flush({ sponsor_logos: [] });
  });

  // Die attachment_id gehoert in den Pfad, nicht in den Rumpf: Der Server sucht
  // sie in den Anhaengen DIESES Objekts (`params[:attachment_id]`).
  it('loescht ueber die attachment_id im Pfad', () => {
    service.remove('leagues', 42, 99).subscribe();

    const req = http.expectOne(
      `${environment.apiURL}admin/leagues/42/sponsor_logos/99`
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ sponsor_logos: [] });
  });
});
