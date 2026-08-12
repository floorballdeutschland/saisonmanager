import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { LiveStreamService } from './live-stream.service';

// Der Dienst hatte keinen Spec. Das ist die eine Stelle, an der ein Tippfehler
// im Pfad nichts Sichtbares hinterlaesst: Die Komponente behandelt einen
// Fehlschlag als "nichts hinterlegt" und zeigt beim Nachladen nicht einmal einen
// Hinweis. Ein falscher Pfad saehe damit genauso aus wie ein Tag ohne
// Uebertragung -- und genau das ist der Fehlermodus dieser Seite.
describe('LiveStreamService', () => {
  let service: LiveStreamService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LiveStreamService],
    });
    service = TestBed.inject(LiveStreamService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Genau die Route aus config/routes.rb in api#376:
  // get 'live_streams', to: 'live_streams#index'
  it('fragt den oeffentlichen Tagesabruf ab', () => {
    service.getToday().subscribe();

    const req = http.expectOne(`${environment.apiURL}live_streams.json`);
    expect(req.request.method).toBe('GET');
    req.flush({ date: '2026-08-11', games: [] });
  });

  // Kein Vorbehalt gegen den Cache des Browsers, aber auch keine Parameter: Was
  // "heute" ist, entscheidet der Server (Europe/Berlin), nicht die Uhr des
  // Besuchers. Ein Datum von hier aus mitzugeben waere ein zweiter Begriff von
  // heute -- genau die Stelle, an der beide auseinanderlaufen.
  it('gibt kein Datum mit, der Server bestimmt den Tag', () => {
    service.getToday().subscribe();

    const req = http.expectOne(`${environment.apiURL}live_streams.json`);
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ date: '2026-08-11', games: [] });
  });

  it('gibt die Antwort unveraendert weiter', () => {
    let empfangen: unknown = null;
    service.getToday().subscribe((d) => (empfangen = d));

    const antwort = {
      date: '2026-08-11',
      games: [{ game_id: 7, status: 'running' }],
    };
    http.expectOne(`${environment.apiURL}live_streams.json`).flush(antwort);

    expect(empfangen).toEqual(antwort);
  });
});
