import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { getTranslocoTestingModule } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        UikitCommonModule,
        getTranslocoTestingModule(),
      ],
      declarations: [PlayerVmIndexComponent],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Regression: Der Button hing an user.club_ids, und die enthält nur die
  // VM-Vereine. Teammanager*innen sahen ihn deshalb nie, obwohl sie den Kader
  // aufstellen und Neuzugänge brauchen. Das Gate ist jetzt die Liste selbst:
  // vm/clubs_and_teams liefert genau die Vereine, in denen die API das
  // Anlegen erlaubt – für Vereins- wie für Teammanager*innen.
  it('zeigt den Anlege-Link auch ohne VM-Vereine', () => {
    const fixture = TestBed.createComponent(PlayerVmIndexComponent);
    fixture.detectChanges();

    http
      .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
      .flush([{ id: 113, name: 'TSV Rohrdorf-Thansau', teams: [] }]);
    http
      .expectOne(`${environment.apiURL}admin/vm/players.json?club_id=113`)
      .flush([]);
    fixture.detectChanges();

    const link: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('a[href]');
    expect(link?.getAttribute('href')).toBe(
      '/verwaltung/vereine/113/spieler/neu'
    );
  });
});
