import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from 'src/environments/environment';

import { TeamSquadComponent } from './team-squad.component';
import { TeamLineupPlayerPipe } from 'src/app/_helpers/_pipes/team-lineup-player.pipe';

describe('TeamSquadComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      // Die Pipe echt, weil genau ihr vierter Parameter geprüft wird; die
      // Kind-Komponenten der Zeile über NO_ERRORS_SCHEMA, sie tragen zur
      // Filterung nichts bei.
      declarations: [TeamSquadComponent, TeamLineupPlayerPipe],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render(requestedLicensePlayable: boolean) {
    const fixture = TestBed.createComponent(TeamSquadComponent);
    fixture.componentInstance.teamId = 7;
    fixture.componentInstance.players = [];
    fixture.componentInstance.requestedLicensePlayable =
      requestedLicensePlayable;
    fixture.detectChanges();

    http.expectOne(`${environment.apiURL}user/team/7/licenses.json`).flush({
      team: { id: 7 },
      current_requests: [
        {
          id: 1,
          last_name: 'Erteilt',
          first_name: 'Anna',
          current_status: { license_status_id: 1 },
        },
        {
          id: 2,
          last_name: 'Beantragt',
          first_name: 'Bert',
          current_status: { license_status_id: 2 },
        },
      ],
    });
    fixture.detectChanges();

    return fixture.nativeElement.querySelectorAll('ul[role="list"] > li')
      .length;
  }

  it('should create', () => {
    // Ohne detectChanges laeuft ngOnInit nicht, also wird auch nichts geladen.
    const fixture = TestBed.createComponent(TeamSquadComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Die Verdrahtung Template → Pipe. Ohne diese Prüfung liesse sich die
  // Übergabe des vierten Pipe-Parameters aus der Vorlage entfernen, ohne dass
  // irgendein Test rot wird: Die Pipe-Spec ruft transform() direkt auf.
  it('bietet mit der Erlaubnis auch die beantragte Lizenz an', () => {
    expect(render(true)).toBe(2);
  });

  it('bietet ohne die Erlaubnis nur die erteilte Lizenz an', () => {
    expect(render(false)).toBe(1);
  });
});
