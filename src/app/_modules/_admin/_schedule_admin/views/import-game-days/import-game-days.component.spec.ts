import { getTranslocoTestingModule } from '@floorball/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ImportGameDaysComponent } from './import-game-days.component';

describe('ImportGameDaysComponent', () => {
  let component: ImportGameDaysComponent;
  let fixture: ComponentFixture<ImportGameDaysComponent>;
  let httpMock: HttpTestingController;

  const datei = () =>
    new File(['x'], 'spielplan.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

  // Baut das Event, wie es ein <input type="file"> liefert. `files` ist eine
  // FileList und laesst sich nicht direkt bauen, deshalb ueber ein Objekt mit
  // der gleichen Form.
  const auswahlEvent = (dateien: File[]) =>
    ({
      target: { files: dateien },
    }) as unknown as Event;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        // Mit echten Texten fuer den Scope, weil die Pruefungen unten die
        // Meldung lesen und der blosse Schluessel sie nicht traegt.
        getTranslocoTestingModule({
          de: {
            scheduleAdmin: {
              importGameDays: {
                noFileSelected: 'Keine Datei ausgewählt.',
                importFailed: 'Der Import ist fehlgeschlagen.',
              },
            },
          },
        }),
        HttpClientTestingModule,
      ],
      declarations: [ImportGameDaysComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ImportGameDaysComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Beim Hochfahren laeuft der Stammdatenabruf der Anwendung mit. Er gehoert
    // nicht zur Maske und wird hier nur abgeraeumt, damit `verify` die offenen
    // Anfragen des Imports meldet und nicht ihn.
    httpMock.match((r) => r.url.includes('init')).forEach((r) => r.flush({}));
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ohne ausgewaehlte Datei', () => {
    // Der Kern des Fehlerbildes: Bis api#568 ging der Anfangswert des
    // Formularfelds als leerer String an die API, die darauf mit 401
    // antwortete. Ein 401 meldet im ErrorInterceptor ab, der Klick endete
    // also auf der Anmeldeseite. Auf Produktion trugen 11 von 12
    // Importversuchen genau diesen leeren Wert.
    it('schickt keine Anfrage', () => {
      component.import();

      httpMock.expectNone((r) => r.url.includes('import_schedule'));
    });

    it('meldet den fehlenden Dateinamen in der Fehlerliste', () => {
      component.import();

      expect(component.errors).toEqual(['Keine Datei ausgewählt.']);
      expect(component.warnings).toEqual([]);
    });

    it('bietet den Import-Knopf nicht an', () => {
      expect(component.hasFile).toBeFalse();

      const knopf = fixture.nativeElement.querySelector('fb-confirmation');
      expect(knopf).toBeNull();
    });
  });

  describe('mit ausgewaehlter Datei', () => {
    beforeEach(() => {
      component.onFileChange(auswahlEvent([datei()]));
      fixture.detectChanges();
    });

    it('bietet den Import-Knopf an', () => {
      expect(component.hasFile).toBeTrue();
      expect(
        fixture.nativeElement.querySelector('fb-confirmation')
      ).not.toBeNull();
    });

    it('schickt die Datei als FormData-Feld "file"', () => {
      component.import();

      const req = httpMock.expectOne(
        (r) => r.method === 'POST' && r.url.includes('import_schedule')
      );
      const body = req.request.body as FormData;
      expect(body instanceof FormData).toBeTrue();
      expect(body.get('file') instanceof File).toBeTrue();

      const router = TestBed.inject(Router);
      spyOn(router, 'navigate').and.resolveTo(true);
      req.flush({ errors: [], warnings: [] });
    });

    // Ein abgebrochener Dateidialog liefert eine leere Liste. Vorher blieb die
    // vorige Auswahl im Formular stehen, obwohl das Feld sichtbar leer war.
    it('nimmt die Auswahl zurueck, wenn der Dialog leer zurueckkommt', () => {
      component.onFileChange(auswahlEvent([]));

      expect(component.hasFile).toBeFalse();
    });
  });

  describe('Fehlerantwort der API', () => {
    beforeEach(() => {
      component.onFileChange(auswahlEvent([datei()]));
      component.import();
    });

    const antworten = (body: string | object, status: number) => {
      const req = httpMock.expectOne(
        (r) => r.method === 'POST' && r.url.includes('import_schedule')
      );
      req.flush(body, { status, statusText: 'Fehler' });
      fixture.detectChanges();
    };

    it('zeigt Fehler und Warnungen aus dem JSON-String in "message"', () => {
      antworten(
        {
          message: JSON.stringify({
            errors: ['Zeile 12: Heimteam nicht erkannt'],
            warnings: ['Zeile 3: Halle inaktiv'],
          }),
        },
        400
      );

      expect(component.errors).toEqual(['Zeile 12: Heimteam nicht erkannt']);
      expect(component.warnings).toEqual(['Zeile 3: Halle inaktiv']);
    });

    // Nicht jede Fehlerantwort auf diese Anfrage kommt aus der Action: ein 502
    // des Reverse Proxy, eine Wartungsseite, ein Abbruch. JSON.parse warf
    // darauf ungeschuetzt mitten im error-Zweig, die Maske blieb dann ohne
    // jede Meldung stehen.
    it('faellt bei unlesbarer Antwort auf einen allgemeinen Hinweis zurueck', () => {
      expect(() => antworten('<html>Bad Gateway</html>', 502)).not.toThrow();

      expect(component.errors).toEqual(['Der Import ist fehlgeschlagen.']);
      expect(component.warnings).toEqual([]);
    });

    it('nimmt die Dateiauswahl nach einem Fehlschlag zurueck', () => {
      antworten(
        { message: JSON.stringify({ errors: ['x'], warnings: [] }) },
        400
      );

      expect(component.hasFile).toBeFalse();
    });
  });
});
