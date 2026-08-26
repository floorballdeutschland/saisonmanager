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
