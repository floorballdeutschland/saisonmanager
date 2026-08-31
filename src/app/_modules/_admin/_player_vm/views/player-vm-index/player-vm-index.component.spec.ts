import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { getTranslocoTestingModule, SessionService } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import { User } from '@floorball/types';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';

import { PlayerVmIndexComponent } from './player-vm-index.component';

describe('PlayerVmIndexComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [PlayerVmIndexComponent],
    })
      .overrideTemplate(PlayerVmIndexComponent, '')
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Regression: Die Ansicht lud ihre Vereine aus user/clubs_and_teams. Wer
  // neben der VM-Rolle auch SBK ist, bekam darüber alle Vereine des
  // Spielbetriebs; für jeden davon wurde die Spielerliste angefragt, und die
  // Vereine fremder Landesverbände antworteten mit 403 – was der
  // ErrorInterceptor global als Berechtigungsfehler samt Weiterleitung
  // quittiert und damit die ganze Seite abbrach.
  it('lädt nur die eigenen VM-/TM-Vereine, nicht den Spielbetriebs-Bestand', () => {
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    http.expectNone(`${environment.apiURL}user/clubs_and_teams.json`);
    const req = http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`);
    req.flush([{ id: 113, name: 'TSV Rohrdorf-Thansau', teams: [] }]);

    // Genau ein Verein → genau eine Spielerliste.
    const playerReq = http.expectOne(
      `${environment.apiURL}admin/vm/players.json?club_id=113`
    );
    playerReq.flush([]);

    expect(fixture.componentInstance.clubLists.length).toBe(1);
    expect(fixture.componentInstance.clubLists[0].club.id).toBe(113);
  });

  // Regression: Der Freitext-Grund wurde aus einem Übersetzungsschlüssel
  // gebaut. Die API akzeptiert aber nur das wörtliche Präfix „Sonstiges: ",
  // also scheiterte die Deaktivierung mit englischer Oberfläche an einem 422.
  it('schickt den Grund „Sonstiges" auch mit englischer Oberfläche deutsch an die API', () => {
    TestBed.inject(TranslocoService).setActiveLang('en');

    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    http
      .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
      .flush([{ id: 113, name: 'TSV Rohrdorf-Thansau', teams: [] }]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([{ id: 42, first_name: 'Alex', last_name: 'Beispiel' }]);

    const list = component.clubLists[0];
    const player = list.players[0];
    component.deactivateReason = 'Sonstiges';
    component.deactivateReasonOther = 'Umzug ins Ausland';
    component.deactivate(list, player);

    const req = http.expectOne(
      `${environment.apiURL}admin/players/42/deactivate.json`
    );
    expect(req.request.body.reason).toBe('Sonstiges: Umzug ins Ausland');
    req.flush(player);
  });
});

// Mit echter Vorlage, weil genau ihr Zustandekommen geprüft wird.
describe('PlayerVmIndexComponent (Vereinsentscheidungen)', () => {
  let http: HttpTestingController;

  async function setup(user: Partial<User>): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        UikitCommonModule,
        // Mit echten Texten fuer den Scope, weil eine der Pruefungen unten die
        // gerenderte Zahl liest und der blosse Schluessel sie nicht traegt.
        getTranslocoTestingModule({
          de: {
            playerVm: {
              index: {
                emailMissingCount: '{{ count }} ohne E-Mail-Adresse',
                emailAllPresent: 'Alle mit E-Mail-Adresse',
                emailMissing: 'fehlt',
              },
            },
          },
        }),
      ],
      declarations: [PlayerVmIndexComponent],
      providers: [
        {
          provide: SessionService,
          useValue: {
            currentUser$: of(user as User) as Observable<User | null>,
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  }

  // `manage_players` je Verein ist die maßgebliche Quelle (api#530);
  // `undefined` steht für eine API, die das Feld noch nicht liefert.
  function zweiVereine(flags: (boolean | undefined)[] = [true, true]): void {
    http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`).flush([
      {
        id: 113,
        name: 'TSV Rohrdorf-Thansau',
        teams: [],
        manage_players: flags[0],
      },
      {
        id: 114,
        name: 'SG Partnerverein',
        teams: [],
        manage_players: flags[1],
      },
    ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([{ id: 1, first_name: 'Aktiv', last_name: 'Beispiel' }]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=114`)
      .flush([{ id: 2, first_name: 'Aktiv', last_name: 'Partner' }]);
  }

  // Beide Knöpfe der Zeile hängen an derselben Entscheidung wie das Anlegen.
  // Über data-testid und nicht über `fb-button`, damit ein zusätzlicher Knopf
  // in der Zeile den Test nicht falsch scheitern lässt.
  function aktionen(fixture: ComponentFixture<PlayerVmIndexComponent>): number {
    return fixture.nativeElement.querySelectorAll(
      '[data-testid="deactivate-player"], [data-testid="reactivate-player"]'
    ).length;
  }

  afterEach(() => http.verify());

  it('zeigt den Anlege-Link an jedem Verein mit manage_players', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine([true, true]);
    fixture.detectChanges();

    // Je Verein ein eigener Link: fängt eine Interpolation, die alle Links
    // auf denselben Verein zeigen ließe.
    const hrefs = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a[data-testid="new-player-link"]'
      ) as NodeListOf<HTMLAnchorElement>
    ).map((a) => a.getAttribute('href'));

    expect(hrefs).toEqual([
      '/verwaltung/vereine/113/spieler/neu',
      '/verwaltung/vereine/114/spieler/neu',
    ]);
    // Je Zeile ein „Deaktivieren".
    expect(aktionen(fixture)).toBe(2);
  });

  // Anlegen, Deaktivieren und Reaktivieren darf nur, wer den Bestand dieses
  // Vereins ordnet (api#530). Die Liste enthält aber auch die Vereine, in denen
  // der Account nur Teammanager ist – dort steht der Knopf abgeblendet mit dem
  // Grund daneben, statt zu verschwinden.
  it('blendet den Knopf im Verein ohne manage_players ab', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine([true, false]);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll(
      'a[data-testid="new-player-link"]'
    ) as NodeListOf<HTMLAnchorElement>;
    expect(Array.from(links).map((a) => a.getAttribute('href'))).toEqual([
      '/verwaltung/vereine/113/spieler/neu',
    ]);

    const disabled = fixture.nativeElement.querySelectorAll(
      'button[data-testid="new-player-disabled"]'
    ) as NodeListOf<HTMLButtonElement>;
    expect(disabled.length).toBe(1);
    expect(disabled[0].disabled).toBeTrue();

    // Nur die Zeile des VM-Vereins trägt „Deaktivieren".
    expect(aktionen(fixture)).toBe(1);
  });

  it('blendet ohne manage_players an jedem Verein ab', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine([false, false]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('a[data-testid="new-player-link"]')
        .length
    ).toBe(0);
    expect(
      fixture.nativeElement.querySelectorAll(
        'button[data-testid="new-player-disabled"]'
      ).length
    ).toBe(2);
    expect(aktionen(fixture)).toBe(0);
  });

  // Rückfall für den Fall, dass das Frontend vor der API ausgerollt wird: Ohne
  // das Feld entscheidet wie bisher die Rollenliste aus dem Browser.
  it('faellt ohne das Feld auf club_ids zurueck', async () => {
    await setup({ club_ids: [113], permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine([undefined, undefined]);
    fixture.detectChanges();

    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll(
          'a[data-testid="new-player-link"]'
        ) as NodeListOf<HTMLAnchorElement>
      ).map((a) => a.getAttribute('href'))
    ).toEqual(['/verwaltung/vereine/113/spieler/neu']);
  });

  it('faellt ohne das Feld fuer Admin und SBK auf update_player zurueck', async () => {
    await setup({ permissions: { update_player: true } });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine([undefined, undefined]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('a[data-testid="new-player-link"]')
        .length
    ).toBe(2);
  });

  // Der zweite Zweig der Zeile: Ein deaktiviertes Profil trägt „Reaktivieren",
  // und zwar unter derselben Bedingung.
  it('zeigt Reaktivieren nur im Verein mit manage_players', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`).flush([
      { id: 113, name: 'Eigener Verein', teams: [], manage_players: true },
      { id: 114, name: 'Nur Mannschaft', teams: [], manage_players: false },
    ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([
        {
          id: 1,
          first_name: 'Weg',
          last_name: 'Eigen',
          deactivated_at: '2026-08-01T00:00:00Z',
        },
      ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=114`)
      .flush([
        {
          id: 2,
          first_name: 'Weg',
          last_name: 'Fremd',
          deactivated_at: '2026-08-01T00:00:00Z',
        },
      ]);
    fixture.detectChanges();

    // Deaktivierte stehen erst hinter dem Schalter.
    fixture.componentInstance.clubLists.forEach((list) =>
      fixture.componentInstance.toggleDeactivated(list)
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="reactivate-player"]'
      ).length
    ).toBe(1);
  });

  // Ohne E-Mail-Adresse laufen Transfer- und Elternzustimmung ins Leere. Die
  // Spalte zeigt sie, die Zahl darüber nennt die Lücken.
  it('zeigt die Adresse je Zeile und zaehlt die fehlenden', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    http
      .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
      .flush([
        { id: 113, name: 'Eigener Verein', teams: [], manage_players: true },
      ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([
        {
          id: 1,
          first_name: 'Mit',
          last_name: 'Adresse',
          email: 'a@example.org',
        },
        { id: 2, first_name: 'Ohne', last_name: 'Adresse', email: null },
        // Ein leergeraeumtes Feld aus dem Altbestand: truthy, aber keine
        // Adresse.
        { id: 3, first_name: 'Leer', last_name: 'Adresse', email: '   ' },
      ]);
    fixture.detectChanges();

    const zeilen: string = fixture.nativeElement.textContent;
    expect(zeilen).toContain('a@example.org');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="email-missing"]')
        .length
    ).toBe(2);
    expect(
      fixture.componentInstance.missingEmailCount(
        fixture.componentInstance.clubLists[0]
      )
    ).toBe(2);
    expect(
      fixture.nativeElement.querySelector('[data-testid="missing-email-count"]')
        .textContent
    ).toContain('2');
  });

  // Die Zahl muss sich mit der Tabelle darunter decken: Ein deaktiviertes
  // Profil ohne Adresse zaehlt erst mit, wenn es eingeblendet ist.
  it('zaehlt deaktivierte erst mit, wenn sie eingeblendet sind', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    http
      .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
      .flush([
        { id: 113, name: 'Eigener Verein', teams: [], manage_players: true },
      ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([
        {
          id: 1,
          first_name: 'Mit',
          last_name: 'Adresse',
          email: 'a@example.org',
        },
        {
          id: 2,
          first_name: 'Weg',
          last_name: 'Ohne',
          email: null,
          deactivated_at: '2026-08-01T00:00:00Z',
        },
      ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const list = component.clubLists[0];
    expect(component.missingEmailCount(list)).toBe(0);

    component.toggleDeactivated(list);
    fixture.detectChanges();

    expect(component.missingEmailCount(list)).toBe(1);
  });

  // Frontend-Deploy vor dem API-Deploy: Die Liste kommt ohne das Feld. Dann
  // muss die Spalte ganz wegbleiben, statt einen komplett gepflegten Verein als
  // lückenhaft zu melden — die Maske sieht aus wie vorher.
  it('laesst Spalte und Zaehler weg, solange die API die Adresse nicht liefert', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    http
      .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
      .flush([
        { id: 113, name: 'Eigener Verein', teams: [], manage_players: true },
      ]);
    // Genau der meta_hash von vor api#565: kein email-Schluessel.
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([{ id: 1, first_name: 'Ohne', last_name: 'Feld' }]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.emailKnown(component.clubLists[0])).toBeFalse();
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="email-missing"]')
        .length
    ).toBe(0);
    expect(
      fixture.nativeElement.querySelector('[data-testid="missing-email-count"]')
    ).toBeNull();
  });

  // Ein Verein ohne Luecke soll das auch bestaetigt bekommen, statt gar nichts
  // zu lesen.
  it('meldet einen vollstaendig gepflegten Verein ausdruecklich', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    http
      .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
      .flush([
        { id: 113, name: 'Eigener Verein', teams: [], manage_players: true },
      ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([
        { id: 1, first_name: 'Mit', last_name: 'Adresse', email: 'a@x.org' },
      ]);
    fixture.detectChanges();

    const zaehler = fixture.nativeElement.querySelector(
      '[data-testid="missing-email-count"]'
    ) as HTMLElement;
    expect(zaehler.textContent).toContain('Alle mit E-Mail-Adresse');
    expect(zaehler.classList).not.toContain('text-red-600');
  });

  // Die Einleitung erklärt das Deaktivieren; ohne einen einzigen eigenen Verein
  // beschreibt sie Knöpfe, die es hier nicht gibt.
  it('laesst die Einleitung weg, wenn kein Verein zu ordnen ist', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine([false, false]);
    fixture.detectChanges();

    expect(fixture.componentInstance.anyClubManageable).toBeFalse();
  });
});

// CSV-Export und CSV-Nachtrag. Mit echter Vorlage, weil Knopf und Link Teil der
// Zusage sind, und mit echten Texten fuer den Scope, weil zwei Pruefungen die
// gerenderten Feldnamen und Gruende lesen.
describe('PlayerVmIndexComponent (CSV)', () => {
  let http: HttpTestingController;
  let blobs: Blob[];

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        UikitCommonModule,
        getTranslocoTestingModule({
          de: {
            playerVm: {
              index: {
                emailMissingCount: '{{ count }} ohne E-Mail-Adresse',
                emailAllPresent: 'Alle mit E-Mail-Adresse',
                importShow: 'Import',
                colEmail: 'E-Mail',
                colBirthdate: 'Geburtsdatum',
                skipAlreadySet: 'war schon gefüllt',
                skipNoPermission: 'nur über den Änderungsantrag',
                licenseLicensed: 'Lizenziert',
                licenseRequested: 'Beantragt',
              },
            },
          },
        }),
      ],
      declarations: [PlayerVmIndexComponent],
      providers: [
        {
          provide: SessionService,
          useValue: {
            currentUser$: of({
              permissions: {},
            } as User) as Observable<User | null>,
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    // downloadCsv haengt seine Datei an ein <a> und klickt es an. Der Klick
    // bleibt hier stumm, der Inhalt wird ueber den Blob gelesen.
    blobs = [];
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');
  }

  function bestand(players: unknown[]): void {
    http
      .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
      .flush([
        { id: 113, name: 'Eigener Verein', teams: [], manage_players: true },
      ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush(players);
  }

  afterEach(() => http.verify());

  // Der Export ist die Vorlage des Imports: Kopfzeile und Datumsformat sind
  // Teil des Vertrags, nicht Kosmetik.
  it('exportiert die Stammdaten mit deutscher Kopfzeile und deutschem Datum', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    bestand([
      {
        id: 42,
        first_name: 'Alex',
        last_name: 'Beispiel',
        birthdate: '2010-02-01',
        gender: 'W',
        nation_id: 1,
        nation_string: 'Deutschland',
        email: 'alex@example.org',
        current_licenses: [
          {
            license_status_id: 1,
            license_status: 'Lizenziert',
            league_id: 7,
            league_short_name: 'BL',
          },
        ],
      },
    ]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="export-csv"]').click();

    expect(blobs.length).toBe(1);
    const text = await blobs[0].text();
    const [header, row] = text.split('\r\n');
    expect(header).toBe(
      '"ID";"Verein";"Nachname";"Vorname";"Geburtsdatum";"Geschlecht";' +
        '"Nationalität";"Nation-ID";"E-Mail";"Lizenzen"'
    );
    expect(row).toBe(
      '"42";"Eigener Verein";"Beispiel";"Alex";"01.02.2010";"w";' +
        '"Deutschland";"1";"alex@example.org";"Lizenziert BL"'
    );
  });

  // Verlangt war der aktive Bestand. Der Schalter „deaktivierte einblenden"
  // steuert die Tabelle und darf den Umfang der Datei nicht mitbestimmen --
  // sonst haengt die Arbeitsgrundlage davon ab, wie die Seite gerade aussah.
  it('exportiert deaktivierte auch dann nicht, wenn sie eingeblendet sind', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    bestand([
      {
        id: 1,
        first_name: 'Aktiv',
        last_name: 'Bleibt',
        birthdate: '2000-01-01',
      },
      {
        id: 2,
        first_name: 'Weg',
        last_name: 'Raus',
        birthdate: '2000-01-01',
        deactivated_at: '2026-08-01T00:00:00Z',
      },
    ]);
    component.toggleDeactivated(component.clubLists[0]);
    fixture.detectChanges();

    component.exportCsv();

    const text = await blobs[0].text();
    expect(text).toContain('"Bleibt"');
    expect(text).not.toContain('"Raus"');
    expect(component.exportablePlayerCount).toBe(1);
  });

  // Die Tabelle schreibt jeden Wert ausser 'M' und 'W' als „d". Fuer die Datei
  // waere das falsch: Aus einem Altbestandswert 'm' wuerde ein „d", und der
  // Import traegt ihn bei leerem Feld genau so ein.
  it('exportiert ein kleingeschriebenes Geschlecht nicht als d', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    bestand([
      {
        id: 1,
        first_name: 'Alt',
        last_name: 'Bestand',
        birthdate: '2000-01-01',
        gender: 'm',
      },
    ]);
    fixture.detectChanges();

    fixture.componentInstance.exportCsv();

    expect(await blobs[0].text()).toContain('"m"');
  });

  it('schickt die gewaehlte Datei mit dem Verein an den Import', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    bestand([{ id: 1, first_name: 'Ohne', last_name: 'Adresse', email: null }]);
    fixture.detectChanges();

    const list = component.clubLists[0];
    component.toggleImport(list);
    fixture.detectChanges();

    const file = new File(['ID;E-Mail\n1;neu@example.org\n'], 'spieler.csv', {
      type: 'text/csv',
    });
    const input = {
      files: [file],
      value: 'spieler.csv',
    } as unknown as HTMLInputElement;
    component.onImportFile(list, { target: input } as unknown as Event);

    const req = http.expectOne(`${environment.apiURL}admin/vm/players/import`);
    const body = req.request.body as FormData;
    expect(body.get('club_id')).toBe('113');
    expect((body.get('file') as File).name).toBe('spieler.csv');

    req.flush({
      total_rows: 1,
      updated: [
        {
          row: 2,
          id: 1,
          name: 'Adresse, Ohne',
          fields: { email: 'neu@example.org' },
          skipped: {},
        },
      ],
      skipped: [],
      not_found: [],
      invalid: [],
    });

    // Ohne das Neuladen stuende der eingetragene Wert bis zum naechsten
    // Seitenaufruf nicht in der Tabelle, und die Zahl darueber widerspraeche
    // dem Bericht darunter.
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([
        {
          id: 1,
          first_name: 'Ohne',
          last_name: 'Adresse',
          email: 'neu@example.org',
        },
      ]);
    fixture.detectChanges();

    expect(component.missingEmailCount(list)).toBe(0);
    expect(
      fixture.nativeElement.querySelector('[data-testid="import-report"]')
    ).toBeTruthy();
  });

  // Der Bericht muss das uebersprungene Feld benennen. Verschluckt er es, sieht
  // eine gepflegte Spalte aus wie ein verlorener Upload, und der naechste
  // Versuch ist dieselbe Datei.
  it('nennt die uebersprungenen Felder mit Grund', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    bestand([{ id: 1, first_name: 'Ohne', last_name: 'Adresse', email: null }]);
    fixture.detectChanges();

    expect(
      component.skippedFieldSummary({
        email: 'already_set',
        birthdate: 'no_permission',
      })
    ).toBe(
      'E-Mail: war schon gefüllt, Geburtsdatum: nur über den Änderungsantrag'
    );
    // Nichts uebersprungen heisst leerer Zusatz, nicht „undefined".
    expect(component.skippedFieldSummary({})).toBe('');
    expect(component.fieldSummary({ email: 'neu@example.org' })).toBe(
      'E-Mail: neu@example.org'
    );
  });

  // Der Grund der API benennt, was an der Datei zu aendern ist (fehlende
  // Spalte, kaputtes Encoding). Eine allgemeine Absage waere hier wertlos.
  it('zeigt die Begruendung der API bei einer unlesbaren Datei', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    bestand([{ id: 1, first_name: 'Ohne', last_name: 'Adresse', email: null }]);
    fixture.detectChanges();

    const list = component.clubLists[0];
    component.toggleImport(list);
    fixture.detectChanges();

    const file = new File(['kaputt'], 'spieler.csv', { type: 'text/csv' });
    const input = {
      files: [file],
      value: 'spieler.csv',
    } as unknown as HTMLInputElement;
    component.onImportFile(list, { target: input } as unknown as Event);

    http
      .expectOne(`${environment.apiURL}admin/vm/players/import`)
      .flush(
        { message: 'Der CSV fehlt die Spalte "ID".' },
        { status: 422, statusText: 'Unprocessable Entity' }
      );
    fixture.detectChanges();

    expect(list.importError).toBe('Der CSV fehlt die Spalte "ID".');
    expect(
      fixture.nativeElement.querySelector('[data-testid="import-error"]')
        .textContent
    ).toContain('Spalte "ID"');
  });

  // Der Import-Zustand haengt am Verein: Wer zwei betreut, darf den Bericht des
  // einen nicht am anderen sehen.
  it('haelt Bericht und Bereich je Verein getrennt', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`).flush([
      { id: 113, name: 'Eigener Verein', teams: [], manage_players: true },
      { id: 114, name: 'SG Partner', teams: [], manage_players: true },
    ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([{ id: 1, first_name: 'A', last_name: 'Eins', email: null }]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=114`)
      .flush([{ id: 2, first_name: 'B', last_name: 'Zwei', email: null }]);
    fixture.detectChanges();

    component.toggleImport(component.clubLists[0]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="import-panel"]')
        .length
    ).toBe(1);
    expect(component.clubLists[1].showImport).toBeFalse();
  });
});

// Der Einstieg in die Spielerdaten-Rangliste (fe#300). Mit echter Vorlage, weil
// die Zusage im Pfad steckt: Der Link traegt die Vereins-ID, und bei zwei
// Vereinen fuehrt ein vertauschtes Segment in die Rangliste des FALSCHEN
// Vereins, ohne dass etwas scheitert -- die API antwortet dann brav.
describe('PlayerVmIndexComponent (Spielerdaten-Einstieg)', () => {
  let http: HttpTestingController;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        UikitCommonModule,
        getTranslocoTestingModule(),
      ],
      declarations: [PlayerVmIndexComponent],
      providers: [
        {
          provide: SessionService,
          useValue: {
            currentUser$: of({
              permissions: {},
            } as User) as Observable<User | null>,
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  it('verlinkt je Vereinsblock auf die Rangliste genau dieses Vereins', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`).flush([
      { id: 113, name: 'Eigener Verein', teams: [], manage_players: true },
      { id: 114, name: 'SG Partner', teams: [], manage_players: false },
    ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=114`)
      .flush([]);
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="player-stats-link"]'
      )
    ).map((a) => (a as HTMLAnchorElement).getAttribute('href'));

    // Auch fuer den Verein, in dem dieses Konto nur Teammanager ist
    // (manage_players false): Die Auswertung haengt an der Leseberechtigung,
    // nicht am Anlegen.
    expect(links).toEqual([
      '/verwaltung/spieler-verein/113/spielerdaten',
      '/verwaltung/spieler-verein/114/spielerdaten',
    ]);
  });
});
