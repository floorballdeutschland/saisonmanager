import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { SessionService, getTranslocoTestingModule } from '@floorball/core';
import { User } from '@floorball/types';
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
      providers: [
        {
          provide: SessionService,
          useValue: {
            currentUser$: of({
              club_ids: [113],
              permissions: {},
            } as unknown as User),
          },
        },
      ],
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
