import { TestBed } from '@angular/core/testing';
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
describe('PlayerVmIndexComponent (Anlege-Button)', () => {
  let http: HttpTestingController;

  async function setup(user: Partial<User>): Promise<void> {
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
            currentUser$: of(user as User) as Observable<User | null>,
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  }

  function zweiVereine(): void {
    http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`).flush([
      { id: 113, name: 'TSV Rohrdorf-Thansau', teams: [] },
      { id: 114, name: 'SG Partnerverein', teams: [] },
    ]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=114`)
      .flush([]);
  }

  afterEach(() => http.verify());

  it('zeigt den Anlege-Link an jedem Verein, in dem der Account VM ist', async () => {
    await setup({ club_ids: [113, 114], permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine();
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
  });

  // Anlegen darf nur der Vereinsmanager des Vereins (api:
  // Club#user_permissions). Die Liste enthält aber auch die Vereine, in denen
  // der Account nur Teammanager ist – dort steht der Knopf abgeblendet mit dem
  // Grund daneben, statt zu verschwinden.
  it('blendet den Knopf im Verein ab, in dem der Account nur TM ist', async () => {
    await setup({ club_ids: [113], permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine();
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
  });

  // Ein reiner Teammanager hat kein club_ids (permission_hash[:vm] ist leer),
  // die Antwort liefert das Feld dann gar nicht.
  it('blendet den Knopf auch ohne club_ids ab', async () => {
    await setup({ permissions: {} });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine();
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
  });

  // Admin und SBK erreichen diese Vereinssicht nur mit einer Vereinsrolle,
  // legen aber überall an; ihr club_ids ist leer (es führt nur VM-Vereine).
  it('zeigt den Link für Admin/SBK auch ohne club_ids', async () => {
    await setup({ permissions: { update_player: true } });
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    zweiVereine();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('a[data-testid="new-player-link"]')
        .length
    ).toBe(2);
  });
});
