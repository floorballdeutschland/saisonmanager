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
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Club, Team } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { of } from 'rxjs';

// Ein echter File-Input braucht DataTransfer; ein Stub mit den beiden Feldern,
// die onLogoSelected liest und schreibt, genügt hier. PNG, damit die
// clientseitige Typ- und Dateigrößenprüfung passiert und der Upload rausgeht.
// Die Quadrat-Regel prüft nur der Server, hier ist sie ohne Belang.
function pngInput(): HTMLInputElement {
  const file = new File(['x'], 'logo.png', { type: 'image/png' });
  return { files: [file], value: 'logo.png' } as unknown as HTMLInputElement;
}

// Ein Verein, dessen Pflichtangaben vollstaendig sind. Seit api#641 gehoeren
// die Rechnungsanschrift und die Kontakt-E-Mail dazu; ohne sie meldet errorMsg
// fuenf Luecken, und jeder Test zu einer anderen Regel liefe gegen die.
function vollstaendigerVerein(overrides: Partial<Club> = {}): Club {
  return {
    name: 'Verein',
    long_name: 'Verein e.V.',
    short_name: 'VER',
    street: 'Musterweg',
    house_number: '1',
    postcode: '30159',
    city: 'Hannover',
    contact_email: 'verein@example.org',
    ...overrides,
  } as Club;
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
    const club = vollstaendigerVerein({
      contact_email: 'a@example.org; b@example.org',
    });

    expect(component.errorMsg(club).length).toBe(1);

    club.contact_email = 'a@example.org';
    expect(component.errorMsg(club)).toEqual([]);
  });

  // Seit api#641 ist die Kontaktadresse Pflicht: Ohne sie erreicht der
  // abgebende Landesverband den aufnehmenden Verein nicht, wenn er die
  // Transferrechnung stellt. Vorher war ein leeres Feld ausdruecklich erlaubt.
  it('errorMsg verlangt eine Kontakt-E-Mail', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    const club = vollstaendigerVerein({ contact_email: '' });

    expect(component.errorMsg(club).length).toBe(1);

    club.contact_email = 'a@example.org';
    expect(component.errorMsg(club)).toEqual([]);
  });

  // Die Rechnungsanschrift. Jedes Feld einzeln, damit die Meldung sagt, welches
  // fehlt -- eine Sammelmeldung laesst den Verein raten.
  it('errorMsg verlangt jedes Feld der Anschrift einzeln', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;

    expect(
      component.errorMsg(
        vollstaendigerVerein({
          street: '',
          house_number: '',
          postcode: '',
          city: '',
        })
      ).length
    ).toBe(4);

    // Leerzeichen sind keine Angabe.
    expect(
      component.errorMsg(vollstaendigerVerein({ postcode: '   ' })).length
    ).toBe(1);

    expect(component.errorMsg(vollstaendigerVerein())).toEqual([]);
  });

  // Der Bestand ist unvollstaendig, es gibt keinen Datenlauf. Ein Verein aus
  // dem Altbestand kommt an der Maske erst wieder vorbei, wenn er die Anschrift
  // nachtraegt -- auch wenn er eigentlich nur den Namen aendern wollte.
  it('errorMsg haelt einen Bestandsverein ohne Anschrift zurueck', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    const club = { name: 'Verein', short_name: 'VER' } as Club;

    expect(component.error(club)).toBeTrue();
  });

  // Der Landesverband bestimmt, welcher Spielbetrieb den Verein verwaltet. Ohne
  // ihn legt die API keinen Verein an, weil er anschliessend in keiner
  // Vereinsliste auftauchen wuerde.
  it('errorMsg verlangt beim Anlegen einen Landesverband', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.editMode = false;
    const club = vollstaendigerVerein();

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
    const club = vollstaendigerVerein();

    expect(component.editMode).toBeTrue();
    expect(component.errorMsg(club)).toEqual([]);
  });

  // Vorher standen im Suchfeld nur Blatt-Verbände, mit der Begründung, ein
  // Verband mit Unterverbänden verwalte keine Vereine. Das trifft nicht zu: Nach
  // dem Datenlauf zu diesem PR ist der Floorballverband Schleswig-Holstein
  // Elternverband des Floorball Bund Hamburg und hat weiter fünf eigene Vereine.
  // Mit der alten Regel fiel er aus der Auswahl, und das Suchfeld zeigte für
  // seine Vereine den Platzhalter, obwohl ein Wert gesetzt war.
  it('bietet auch Landesverbaende mit Unterverbaenden zur Auswahl an', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.stateAssociations = [
      { id: 14, name: 'Floorball Bund Hamburg', parent_id: 5 },
      { id: 5, name: 'Floorballverband Schleswig-Holstein' },
    ] as never;

    component['_refreshSelectableStateAssociations']();

    const ids = component.selectableStateAssociations.map((sa) => sa.id);
    expect(ids).toContain(5);
    expect(ids).toContain(14);
    // Alphabetisch, damit die Trefferliste des Suchfelds stabil bleibt.
    expect(ids).toEqual([14, 5]);
  });

  // Der Spielverbund ist der Wurzel-Landesverband der Kette und wird nur
  // angezeigt, nicht gepflegt.
  //
  // Das Fixture ist DREIstufig. Bei zwei Ebenen sind "eine Ebene hoch" und "bis
  // zur Wurzel" dasselbe, der Test koennte den Unterschied also nicht sehen und
  // wuerde etwas behaupten, was der Code nicht tut. Der Server leitet die
  // Zustaendigkeit ueber StateAssociation.root_id ab, und das laeuft bis zur
  // Wurzel.
  it('getSportverbund folgt der Verbandskette bis zur Wurzel', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.stateAssociations = [
      { id: 1, name: 'Floorball-Verband Deutschland' },
      { id: 6, name: 'SBK Ost', parent_id: 1 },
      { id: 13, name: 'Floorballverband Sachsen', parent_id: 6 },
    ] as never;

    expect(
      component.getSportverbund({ state_association_id: 13 } as Club)
    ).toBe('Floorball-Verband Deutschland');
    expect(component.getSportverbund({ state_association_id: 6 } as Club)).toBe(
      'Floorball-Verband Deutschland'
    );
    expect(component.getSportverbund({ state_association_id: 1 } as Club)).toBe(
      'Floorball-Verband Deutschland'
    );
    expect(component.getSportverbund({} as Club)).toBe('–');
  });

  // Bricht die Kette an einem geloeschten Verband ab, bleibt der letzte bekannte
  // stehen statt auf "–" zu fallen. Auf state_associations.parent_id liegt kein
  // Fremdschluessel; der Server verhaelt sich genauso (`parents.key?(up)`).
  it('getSportverbund bleibt beim letzten bekannten Verband stehen', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.stateAssociations = [
      { id: 13, name: 'Floorballverband Sachsen', parent_id: 999 },
    ] as never;

    expect(
      component.getSportverbund({ state_association_id: 13 } as Club)
    ).toBe('Floorballverband Sachsen');
  });

  // Ein Ringverweis aus der Zeit vor der Zyklus-Pruefung darf die Maske nicht in
  // eine Endlosschleife schicken. Gleiche Vorsorge wie in
  // StateAssociation.build_tree auf der Serverseite.
  it('getSportverbund haelt einen Ringverweis aus', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    component.stateAssociations = [
      { id: 1, name: 'A', parent_id: 2 },
      { id: 2, name: 'B', parent_id: 1 },
    ] as never;

    expect(['A', 'B']).toContain(
      component.getSportverbund({ state_association_id: 1 } as Club)
    );
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

  // Der Regelfall bleibt das Vereinslogo: `logo` ist das eigene Logo der
  // Mannschaft, `logo_url` das, was sie zeigt. Nach dem Hochladen sind beide
  // dasselbe Bild -- daran haengen Kennzeichnung und Zuruecksetzen-Knopf.
  it('onTeamLogoSelected laedt hoch und markiert die Mannschaft als eigenes Logo', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    const team = { id: 7, name: 'Alpha', manage_logo: true } as Team;
    const input = pngInput();

    component.onTeamLogoSelected(team, input);

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/teams/7/upload_logo.json`
    );
    expect((req.request.body as FormData).get('logo')).toBeTruthy();
    req.flush({ logo_url: '/t.png', logo_small_url: '/ts.png' });

    expect(team.logo).toBe('/t.png');
    expect(team.logo_url).toBe('/t.png');
    expect(team.logo_small).toBe('/ts.png');
    expect(input.value).toBe('');
  });

  // Zuruecknehmen fuehrt nicht in einen Zustand ohne Zeichen: Die Antwort nennt
  // das Vereinslogo, und genau das muss die Maske danach zeigen.
  it('removeTeamLogo setzt auf das zurueckgemeldete Vereinslogo zurueck', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    const team = {
      id: 7,
      name: 'Alpha',
      logo: '/t.png',
      logo_url: '/t.png',
      manage_logo: true,
    } as Team;
    spyOn(window, 'confirm').and.returnValue(true);

    component.removeTeamLogo(team);

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/teams/7/logo.json`
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ logo_url: '/club.png', logo_small_url: '/club-s.png' });

    expect(team.logo).toBeUndefined();
    expect(team.logo_url).toBe('/club.png');
    expect(component.removingTeamLogoId).toBeUndefined();
  });

  it('removeTeamLogo schickt ohne Bestaetigung keine Anfrage', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    spyOn(window, 'confirm').and.returnValue(false);

    component.removeTeamLogo({ id: 7, logo: '/t.png' } as Team);

    expect(window.confirm).toHaveBeenCalled();
    httpMock.expectNone(`${environment.apiURL}admin/teams/7/logo.json`);
  });

  it('onTeamLogoSelected weist eine Nicht-Bilddatei ohne Anfrage ab', () => {
    const component =
      TestBed.createComponent(ClubEditComponent).componentInstance;
    const errorSpy = spyOn(TestBed.inject(NotificationService), 'error');
    const file = new File(['x'], 'logo.gif', { type: 'image/gif' });
    const input = {
      files: [file],
      value: 'logo.gif',
    } as unknown as HTMLInputElement;

    component.onTeamLogoSelected({ id: 7, manage_logo: true } as Team, input);

    expect(errorSpy).toHaveBeenCalled();
    httpMock.expectNone(`${environment.apiURL}admin/teams/7/upload_logo.json`);
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

  // Der Verein entscheidet, ob seine Teammanager*innen Spieler anlegen,
  // deaktivieren und reaktivieren dürfen. Der Haken steht im
  // Vereinsformular, weil dort der Vereinsmanager sitzt: Wer das Recht
  // bekommt, erreicht diese Maske nicht.
  it('schickt die Freigabe fuer Teammanager mit', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    const component = fixture.componentInstance;
    const club = {
      id: 42,
      name: 'Verein',
      long_name: 'Verein e.V.',
      short_name: 'VER',
      team_managers_manage_players: true,
    } as Club;

    component.submit(club);

    const req = httpMock.expectOne(`${environment.apiURL}admin/clubs.json`);
    expect((req.request.body as Club).team_managers_manage_players).toBeTrue();
    req.flush(club);
  });

  // Gegenprobe: Das Zurücknehmen muss als `false` ankommen und nicht als
  // fehlendes Feld -- die API würde es sonst gar nicht schreiben und der
  // Haken käme beim nächsten Laden wieder gesetzt zurück.
  it('schickt die zurueckgenommene Freigabe als false', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    const component = fixture.componentInstance;
    const club = {
      id: 42,
      name: 'Verein',
      long_name: 'Verein e.V.',
      short_name: 'VER',
      team_managers_manage_players: false,
    } as Club;

    component.submit(club);

    const req = httpMock.expectOne(`${environment.apiURL}admin/clubs.json`);
    expect((req.request.body as Club).team_managers_manage_players).toBeFalse();
    req.flush(club);
  });

  // Der Haken erscheint nur beim Bearbeiten: Ein gerade angelegter Verein hat
  // keine Mannschaften und damit niemanden, für den er etwas bewirkte. Ohne
  // Routen-Parameter geht die Maske in den Anlege-Modus, das ist also die
  // Gegenprobe.
  it('zeigt die Freigabe beim Anlegen noch nicht', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.editMode).toBeFalse();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="team-managers-manage-players"]'
      )
    ).toBeNull();
  });
});

// Eigener Block, weil hier ein Routen-Parameter nötig ist: Ohne clubId geht die
// Maske in den Anlege-Modus, und `editMode` nachträglich umzuschalten wirft
// NG0100 (die Überschrift hängt ebenfalls daran).
describe('ClubEditComponent im Bearbeiten-Modus', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        // Das Vereinsformular bindet mit ngModel; ohne FormsModule bleibt die
        // Bindung wirkungslos und ein Haken stünde im Test immer leer da.
        FormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [ClubEditComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ clubId: '42' }) },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  it('zeigt die Freigabe fuer Teammanager als Haken', async () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiURL}admin/clubs/42/managers.json`)
      .flush({ notify_user_ids: [], managers: [] });
    httpMock.expectOne(`${environment.apiURL}admin/clubs/42.json`).flush({
      id: 42,
      name: 'Verein',
      long_name: 'Verein e.V.',
      short_name: 'VER',
      // Eingeschränkte Fassung, damit das Suchfeld für den Landesverband gar
      // nicht gerendert wird: `fb-select-search` ist hier nicht deklariert.
      // Auf den Haken hat das keinen Einfluss, er steht beiden offen.
      edit_restricted: true,
      team_managers_manage_players: true,
    });
    fixture.detectChanges();
    // ngModel schreibt den Wert erst in einer Mikrotask in das Feld; ohne das
    // Warten stünde der Haken hier noch leer da.
    await fixture.whenStable();
    fixture.detectChanges();

    const haken: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="team-managers-manage-players"]'
    );
    expect(haken).not.toBeNull();
    expect(haken.checked).toBeTrue();
  });

  // Der Verein pflegt seine Anschrift selbst -- auch mit dem eingeschraenkten
  // Formular des Vereinsmanagers, das Bundesland und Landesverband nur als
  // Klartext zeigt. Stuende der Anschriftsblock im gesperrten Zweig, waere ein
  // Vereinsmanager dauerhaft ausgesperrt: `errorMsg()` verlangt die Felder
  // unabhaengig davon, ob die Maske sie ueberhaupt anbietet.
  it('laesst den eingeschraenkten VM die Anschrift eingeben', async () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiURL}admin/clubs/42/managers.json`)
      .flush({ notify_user_ids: [], managers: [] });
    httpMock.expectOne(`${environment.apiURL}admin/clubs/42.json`).flush({
      id: 42,
      name: 'Verein',
      long_name: 'Verein e.V.',
      short_name: 'VER',
      edit_restricted: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    for (const feld of ['street', 'house_number', 'postcode', 'city']) {
      expect(fixture.nativeElement.querySelector(`input#${feld}`))
        .withContext(feld)
        .not.toBeNull();
    }
  });

  // Der Bestand traegt keine Anschrift, der Fehlerzustand gilt also zunaechst
  // fuer jeden Verein. Bliebe er die Klammer der ganzen Knopfleiste, haette die
  // Maske bis zum Nachtragen ueberhaupt keinen Knopf mehr -- auch keinen
  // Abbrechen.
  it('nimmt nur den Speichern-Knopf weg, nicht die ganze Leiste', async () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiURL}admin/clubs/42/managers.json`)
      .flush({ notify_user_ids: [], managers: [] });
    httpMock.expectOne(`${environment.apiURL}admin/clubs/42.json`).flush({
      id: 42,
      name: 'Verein',
      short_name: 'VER',
      edit_restricted: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('clubAdmin.edit.saveChanges');
    expect(text).toContain('clubAdmin.edit.cancel');
  });

  // Die Mannschaftsliste kommt aus einem eigenen Endpunkt; ohne den Abruf beim
  // Laden staende der Abschnitt dauerhaft leer da.
  it('laedt die Mannschaften des Vereins und zeigt sie mit ihrer Kennzeichnung', async () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiURL}admin/clubs/42/managers.json`)
      .flush({ notify_user_ids: [], managers: [] });
    httpMock.expectOne(`${environment.apiURL}admin/clubs/42/teams.json`).flush([
      {
        id: 7,
        name: 'Alpha',
        logo: '/t.png',
        logo_url: '/t.png',
        manage_logo: true,
      },
      { id: 8, name: 'Beta', logo_url: '/club.png', manage_logo: true },
      { id: 9, name: 'Gamma', logo_url: '/club.png', manage_logo: false },
    ]);
    // `edit_restricted` wie in den Nachbartests: Genau so sieht der
    // Vereinsmanager die Maske, und das Suchfeld fuer den Landesverband (dessen
    // Komponente in diesem TestBed fehlt) bleibt damit aussen vor.
    httpMock
      .expectOne(`${environment.apiURL}admin/clubs/42.json`)
      .flush(vollstaendigerVerein({ id: 42, edit_restricted: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alpha');
    expect(text).toContain('Beta');
    // Eigenes Logo und Vereinslogo muessen unterscheidbar sein, sonst ist nicht
    // zu sehen, welche Mannschaft ueberhaupt ein abweichendes Logo traegt.
    expect(text).toContain('clubAdmin.edit.teamLogoOwn');
    expect(text).toContain('clubAdmin.edit.teamLogoFromClub');
    // Ohne Recht kein Knopf, sondern die Begruendung: Das Logo folgt dem
    // Spielbetrieb der Liga.
    expect(text).toContain('clubAdmin.edit.teamLogoForeignLeague');
    expect(fixture.nativeElement.querySelectorAll('input[type=file]').length)
      .withContext('Vereinslogo plus zwei pflegbare Mannschaften')
      .toBe(3);
  });

  // „Keine Mannschaft gemeldet" ist eine Tatsachenbehauptung. Beim
  // fehlgeschlagenen Abruf hat sie niemand geprueft -- dann gehoert dort ein
  // Fehlerhinweis samt zweitem Versuch hin.
  it('meldet einen fehlgeschlagenen Abruf statt eine leere Liste zu zeigen', async () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiURL}admin/clubs/42/managers.json`)
      .flush({ notify_user_ids: [], managers: [] });
    httpMock
      .expectOne(`${environment.apiURL}admin/clubs/42/teams.json`)
      .flush(
        { message: 'kaputt' },
        { status: 500, statusText: 'Server Error' }
      );
    // `edit_restricted` wie in den Nachbartests: Genau so sieht der
    // Vereinsmanager die Maske, und das Suchfeld fuer den Landesverband (dessen
    // Komponente in diesem TestBed fehlt) bleibt damit aussen vor.
    httpMock
      .expectOne(`${environment.apiURL}admin/clubs/42.json`)
      .flush(vollstaendigerVerein({ id: 42, edit_restricted: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('clubAdmin.edit.teamLogosLoadError');
    expect(text).not.toContain('clubAdmin.edit.teamLogosEmpty');
  });
});
