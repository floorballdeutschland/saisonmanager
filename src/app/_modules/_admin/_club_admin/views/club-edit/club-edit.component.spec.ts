import { TestBed } from '@angular/core/testing';

import { ClubEditComponent } from './club-edit.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  getTranslocoTestingModule,
  NotificationService,
} from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Club } from '@floorball/types';
import { environment } from 'src/environments/environment';

// Ein echter File-Input braucht DataTransfer; ein Stub mit den beiden Feldern,
// die onLogoSelected liest und schreibt, genügt hier. PNG, damit die
// clientseitige Typ- und Dateigrößenprüfung passiert und der Upload rausgeht.
// Die Quadrat-Regel prüft nur der Server, hier ist sie ohne Belang.
function pngInput(): HTMLInputElement {
  const file = new File(['x'], 'logo.png', { type: 'image/png' });
  return { files: [file], value: 'logo.png' } as unknown as HTMLInputElement;
}

describe('ClubEditComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [ClubEditComponent],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Bundesland, Spielverbund und Landesverband ordnen den Verein ein und
  // bleiben dem Verband vorbehalten. Das Backend verwirft die Felder für
  // Vereinsmanager ohnehin (restricted_club_params); das Formular soll sie
  // deshalb gar nicht erst als änderbar anbieten.
  it('isRestricted folgt dem Benutzer-Flag, solange kein Verein geladen ist', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;

    component.permissions = {};
    expect(component.isRestricted).toBeFalse();

    component.permissions = { club_edit_restricted: true };
    expect(component.isRestricted).toBeTrue();
  });

  // Die Berechtigung gilt pro Verein: Wer eine Spielbetriebsrolle fuer einen
  // Verband UND eine Vereinsrolle fuer einen Verein aus einem anderen Verband
  // hat, darf beim einen alles und beim anderen nur die Stammdaten. Vorher zeigte
  // das Formular ihm die aenderbaren Felder, und das Speichern verwarf sie
  // stillschweigend.
  it('der geladene Verein schlaegt das Benutzer-Flag', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.permissions = { club_edit_restricted: false };

    component.clubEditRestricted = true;
    expect(component.isRestricted).toBeTrue();

    component.clubEditRestricted = false;
    component.permissions = { club_edit_restricted: true };
    expect(component.isRestricted).toBeFalse();
  });

  it('zeigt Bundesland und Landesverband als Klartext an', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.stateAssociations = [
      { id: 7, name: 'Floorball Verband NRW' },
    ] as never;

    const club = { state: 'de-nw', state_association_id: 7 } as Club;
    expect(component.getStateName(club)).toBe('Nordrhein-Westfalen');
    expect(component.getStateAssociationName(club)).toBe(
      'Floorball Verband NRW'
    );

    const leer = {} as Club;
    expect(component.getStateName(leer)).toBe('–');
    expect(component.getStateAssociationName(leer)).toBe('–');
  });

  it('bietet Sonstige fuer Vereine mit Sitz im Ausland an', () => {
    // Die Auswahl kommt aus CLUB_STATE_OPTIONS, nicht aus GERMAN_STATES: dort
    // fehlt „Sonstige" absichtlich, weil ein Landesverband dafür nicht
    // zuständig sein kann. Stellt jemand die Vereinsmaske später auf die
    // engere Liste um, weil der Name allgemeiner klingt, verlieren Vereine im
    // Ausland ihre Option und zeigen „–" statt „Sonstige".
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;

    expect(component.states.length).toBe(17);
    expect(component.states.map((s) => s.isocode)).toContain('de-sonstige');
    expect(component.getStateName({ state: 'de-sonstige' } as Club)).toBe(
      'Sonstige'
    );
  });

  it('toggleNotifyUser nimmt Vereinsmanager auf und wieder heraus', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;

    expect(component.isNotifyUser(7)).toBeFalse();

    component.toggleNotifyUser(7);
    component.toggleNotifyUser(9);
    expect(component.notifyUserIds).toEqual([7, 9]);

    component.toggleNotifyUser(7);
    expect(component.notifyUserIds).toEqual([9]);
    expect(component.isNotifyUser(7)).toBeFalse();
  });

  // Auf Produktion trug ein Verein zwei Adressen mit Semikolon getrennt im
  // Feld. Beide bekamen nie etwas, weil das Feld als eine Adresse verschickt
  // wird.
  it('errorMsg weist zwei Adressen im Kontaktfeld ab', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    const club = {
      name: 'Verein',
      long_name: 'Verein e.V.',
      short_name: 'VER',
      contact_email: 'a@example.org; b@example.org',
    } as Club;

    expect(component.errorMsg(club).length).toBe(1);

    club.contact_email = 'a@example.org';
    expect(component.errorMsg(club)).toEqual([]);

    club.contact_email = '';
    expect(component.errorMsg(club)).toEqual([]);
  });

  // Der Landesverband bestimmt, welcher Spielbetrieb den Verein verwaltet. Ohne
  // ihn legt die API keinen Verein an, weil er anschliessend in keiner
  // Vereinsliste auftauchen wuerde.
  it('errorMsg verlangt beim Anlegen einen Landesverband', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.editMode = false;
    const club = {
      name: 'Verein',
      long_name: 'Verein e.V.',
      short_name: 'VER',
    } as Club;

    expect(component.errorMsg(club).length).toBe(1);

    club.state_association_id = 7;
    expect(component.errorMsg(club)).toEqual([]);
  });

  // Gegenprobe: Beim Bearbeiten darf das Feld leer bleiben. Sonst waeren
  // ausgerechnet die Vereine ohne Landesverband nicht mehr pflegbar, also die,
  // deren Stammdaten am dringendsten Pflege brauchen. Ob das Leeren erlaubt ist,
  // entscheidet die Berechtigung und damit der Server.
  it('errorMsg laesst den Landesverband beim Bearbeiten leer', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    const club = {
      name: 'Verein',
      long_name: 'Verein e.V.',
      short_name: 'VER',
    } as Club;

    expect(component.editMode).toBeTrue();
    expect(component.errorMsg(club)).toEqual([]);
  });

  // Der Spielverbund ist der Wurzel-Landesverband der Kette und wird nur
  // angezeigt, nicht gepflegt. Fuer die Untergliederung von SBK Ost ist das der
  // Dachverband, fuer einen parentlosen Verband er selbst.
  it('getSportverbund folgt der Verbandskette nach oben', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.stateAssociations = [
      { id: 6, name: 'SBK Ost' },
      { id: 13, name: 'Floorballverband Sachsen', parent_id: 6 },
    ] as never;

    expect(
      component.getSportverbund({ state_association_id: 13 } as Club)
    ).toBe('SBK Ost');
    expect(component.getSportverbund({ state_association_id: 6 } as Club)).toBe(
      'SBK Ost'
    );
    expect(component.getSportverbund({} as Club)).toBe('–');
  });

  it('onLogoSelected posts the file as FormData and applies both returned urls', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    const component = fixture.componentInstance;
    const club = { id: 42, name: 'Testverein' } as Club;
    const input = pngInput();

    component.onLogoSelected(club, input);

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/clubs/42/upload_logo.json`
    );
    // Der Feldname muss 'logo' bleiben, sonst weist die API jeden Upload ab.
    expect((req.request.body as FormData).get('logo')).toBeTruthy();
    req.flush({ logo_url: '/l.png', logo_small_url: '/s.png' });

    expect(club.logo_url).toBe('/l.png');
    expect(club.logo_small_url).toBe('/s.png');
    expect(input.value).toBe('');
  });

  it('onLogoSelected rejects a non-image before any request goes out', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    const component = fixture.componentInstance;
    const errorSpy = spyOn(TestBed.inject(NotificationService), 'error');

    const file = new File(['x'], 'logo.gif', { type: 'image/gif' });
    const input = {
      files: [file],
      value: 'logo.gif',
    } as unknown as HTMLInputElement;

    component.onLogoSelected({ id: 42, name: 'Testverein' } as Club, input);

    httpMock.expectNone(`${environment.apiURL}admin/clubs/42/upload_logo.json`);
    expect(errorSpy).toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('onLogoSelected rejects a file above the 3 MB limit before any request', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    const component = fixture.componentInstance;
    const errorSpy = spyOn(TestBed.inject(NotificationService), 'error');

    const file = new File([new ArrayBuffer(3 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    });
    const input = {
      files: [file],
      value: 'big.png',
    } as unknown as HTMLInputElement;

    component.onLogoSelected({ id: 42, name: 'Testverein' } as Club, input);

    httpMock.expectNone(`${environment.apiURL}admin/clubs/42/upload_logo.json`);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('onLogoSelected adds no own notification when the upload is rejected', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    const errorSpy = spyOn(notificationService, 'error');

    const input = pngInput();
    component.onLogoSelected({ id: 42, name: 'Testverein' } as Club, input);

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/clubs/42/upload_logo.json`
    );
    expect(req.request.method).toBe('POST');
    req.flush(
      { message: 'Das Logo muss quadratisch sein (gleiche Breite und Höhe).' },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    // In der App zeigt der ErrorInterceptor die Servermeldung (abgesichert in
    // error.interceptor.spec.ts). Hier wird nur geprüft, dass die Komponente
    // keinen zweiten Toast ergänzt, der die erste überdeckt (#228).
    expect(errorSpy).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });
});
