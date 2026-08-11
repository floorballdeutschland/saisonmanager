import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { getTranslocoTestingModule } from '@floorball/core';
import { SponsorLogosComponent } from './sponsor-logos.component';

// Eine Komponente fuer beide Ebenen ist richtig -- damit haengen aber Liga und
// Verein an denselben Zweigen, und ein Fehler trifft immer beide.
describe('SponsorLogosComponent', () => {
  let fixture: ComponentFixture<SponsorLogosComponent>;
  let component: SponsorLogosComponent;
  let http: HttpTestingController;

  const logo = (id: number, filename: string) => ({
    id,
    url: `/rails/blob/${id}`,
    filename,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SponsorLogosComponent],
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SponsorLogosComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  function starte(scope: 'leagues' | 'clubs', ownerId: number) {
    component.scope = scope;
    component.ownerId = ownerId;
    fixture.detectChanges();
  }

  function eingabefeld(dateien: File[]): HTMLInputElement {
    // Ein echtes input-Element mit gesetzter FileList waere ohne DataTransfer
    // nicht herstellbar; die Komponente liest nur `files` und `value`.
    return {
      files: dateien,
      value: 'C:\\fake\\partner.png',
    } as unknown as HTMLInputElement;
  }

  it('laedt die vorhandenen Logos der eigenen Ebene', () => {
    starte('clubs', 7);

    const req = http.expectOne(
      `${environment.apiURL}admin/clubs/7/sponsor_logos`
    );
    req.flush({ sponsor_logos: [logo(1, 'a.png'), logo(2, 'b.png')] });

    expect(component.logos.length).toBe(2);
    expect(component.limitReached).toBeFalse();
  });

  // Ohne id gibt es kein Objekt, an das ein Anhang gehen koennte. Der Abruf darf
  // dann gar nicht laufen -- sonst ginge er auf `.../clubs/undefined/...`.
  it('fragt ohne ownerId gar nicht erst nach', () => {
    starte('clubs', 0);

    http.expectNone(() => true);
    expect(component.logos).toEqual([]);
  });

  // Absichtlich stumm: Der Abruf klaert nur, was schon da ist.
  it('bleibt bei einem Fehler des Abrufs bei einer leeren Liste', () => {
    starte('leagues', 42);

    http
      .expectOne(`${environment.apiURL}admin/leagues/42/sponsor_logos`)
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(component.logos).toEqual([]);
    expect(component.error).toBe('');
  });

  it('meldet die Obergrenze, sobald sie erreicht ist', () => {
    starte('leagues', 42);

    const acht = Array.from({ length: 8 }, (_, i) => logo(i + 1, `p${i}.png`));
    http
      .expectOne(`${environment.apiURL}admin/leagues/42/sponsor_logos`)
      .flush({ sponsor_logos: acht });

    expect(component.limitReached).toBeTrue();
  });

  // Die Groessenpruefung ist bewusst doppelt (Server und hier). Sie darf die
  // Datei gar nicht erst uebertragen.
  it('weist eine zu grosse Datei ohne Anfrage ab', () => {
    starte('clubs', 7);
    http
      .expectOne(`${environment.apiURL}admin/clubs/7/sponsor_logos`)
      .flush({ sponsor_logos: [] });

    const gross = new File(['x'], 'gross.png', { type: 'image/png' });
    Object.defineProperty(gross, 'size', { value: 2 * 1024 * 1024 });
    const input = eingabefeld([gross]);

    component.onFileSelected(input);

    http.expectNone(() => true);
    expect(component.error).toBeTruthy();
    expect(component.busy).toBeFalse();
    expect(input.value).toBe('');
  });

  // Die Fehlermeldungen standen als deutsche Zeichenketten im Code, waehrend das
  // Sprachpaket nur die Beschriftungen kannte: Oberflaeche englisch,
  // Fehlermeldung darunter deutsch. Der Test haelt fest, dass sie durch
  // Transloco laufen -- ein rohdeutscher Text faellt damit auf.
  it('nennt Fehler ueber das Sprachpaket, nicht als festen deutschen Text', () => {
    starte('clubs', 7);
    http
      .expectOne(`${environment.apiURL}admin/clubs/7/sponsor_logos`)
      .flush({ sponsor_logos: [] });

    const gross = new File(['x'], 'gross.png', { type: 'image/png' });
    Object.defineProperty(gross, 'size', { value: 2 * 1024 * 1024 });
    component.onFileSelected(eingabefeld([gross]));

    // Der Test-Loader liefert den Schluessel selbst zurueck, wenn er keine
    // Uebersetzung kennt. Beides ist ein Beweis dafuer, dass uebersetzt wird;
    // der feste deutsche Satz waere keiner.
    expect(component.error).not.toBe(
      'Die Datei ist zu groß. Maximal 1 MB erlaubt.'
    );
    expect(component.error).toContain('sponsorLogos.errTooLarge');
  });

  it('uebernimmt die Liste aus der Antwort des Hochladens', () => {
    starte('clubs', 7);
    http
      .expectOne(`${environment.apiURL}admin/clubs/7/sponsor_logos`)
      .flush({ sponsor_logos: [] });

    const datei = new File(['x'], 'partner.png', { type: 'image/png' });
    const input = eingabefeld([datei]);
    component.onFileSelected(input);
    expect(component.busy).toBeTrue();

    const req = http.expectOne(
      `${environment.apiURL}admin/clubs/7/sponsor_logos`
    );
    expect(req.request.method).toBe('POST');
    req.flush({ sponsor_logos: [logo(3, 'partner.png')] });

    expect(component.logos.length).toBe(1);
    expect(component.busy).toBeFalse();
    // Ohne Zuruecksetzen loeste dieselbe Datei kein change-Ereignis mehr aus und
    // ein zweiter Versuch nach einem Fehler blieb wirkungslos.
    expect(input.value).toBe('');
  });

  // Der Server antwortet mit einer eigenen Meldung (Format, Groesse,
  // Obergrenze). Die gehoert angezeigt, nicht durch einen Sammeltext ersetzt.
  it('zeigt die Meldung des Servers, wenn er eine schickt', () => {
    starte('clubs', 7);
    http
      .expectOne(`${environment.apiURL}admin/clubs/7/sponsor_logos`)
      .flush({ sponsor_logos: [] });

    component.onFileSelected(
      eingabefeld([new File(['x'], 'partner.svg', { type: 'image/png' })])
    );

    http
      .expectOne(`${environment.apiURL}admin/clubs/7/sponsor_logos`)
      .flush(
        { message: 'Ungültiges Dateiformat. Erlaubt sind PNG, JPG oder WebP.' },
        { status: 422, statusText: 'Unprocessable Entity' }
      );

    expect(component.error).toContain('Ungültiges Dateiformat');
    expect(component.busy).toBeFalse();
  });

  it('entfernt ein Logo ueber seine attachment_id', () => {
    starte('leagues', 42);
    http
      .expectOne(`${environment.apiURL}admin/leagues/42/sponsor_logos`)
      .flush({ sponsor_logos: [logo(5, 'weg.png')] });

    component.onRemove(component.logos[0]);

    const req = http.expectOne(
      `${environment.apiURL}admin/leagues/42/sponsor_logos/5`
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ sponsor_logos: [] });

    expect(component.logos).toEqual([]);
    expect(component.busy).toBeFalse();
  });

  // Ohne diese Sperre koennte ein Doppelklick zwei Loeschungen ausloesen; die
  // zweite traefe eine attachment_id, die es nicht mehr gibt.
  it('laesst waehrend eines laufenden Vorgangs keinen zweiten zu', () => {
    starte('leagues', 42);
    http
      .expectOne(`${environment.apiURL}admin/leagues/42/sponsor_logos`)
      .flush({ sponsor_logos: [logo(5, 'weg.png')] });

    component.onRemove(component.logos[0]);
    const req = http.expectOne(
      `${environment.apiURL}admin/leagues/42/sponsor_logos/5`
    );

    component.onRemove(component.logos[0]);
    http.expectNone(`${environment.apiURL}admin/leagues/42/sponsor_logos/5`);

    req.flush({ sponsor_logos: [] });
  });
});
