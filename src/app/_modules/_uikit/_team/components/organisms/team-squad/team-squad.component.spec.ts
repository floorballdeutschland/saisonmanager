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

  describe('Aufstellung aus letztem Spiel übernehmen', () => {
    const copyUrl = `${environment.apiURL}user/games/42/lineup/home/copy_from_last_game.json`;

    function open(players: { player_id: number; trikot_number: number }[]) {
      const fixture = TestBed.createComponent(TeamSquadComponent);
      fixture.componentRef.setInput('teamId', 7);
      fixture.componentRef.setInput('gameId', 42);
      fixture.componentRef.setInput('side', 'home');
      fixture.componentRef.setInput('players', players);
      fixture.detectChanges();
      http
        .expectOne(`${environment.apiURL}user/team/7/licenses.json`)
        .flush({ team: { id: 7 }, current_requests: [] });
      fixture.detectChanges();
      return fixture;
    }

    it('bietet die Übernahme nur bei leerer Aufstellung an', () => {
      expect(open([]).nativeElement.querySelector('fb-button')).toBeTruthy();
      expect(
        open([{ player_id: 1, trikot_number: 4 }]).nativeElement.querySelector(
          'fb-button'
        )
      ).toBeNull();
    });

    it('übernimmt die Aufstellung und zeigt Übersprungenes', () => {
      const fixture = open([]);

      fixture.componentInstance.copyFromLastGame();
      const req = http.expectOne(copyUrl);
      expect(req.request.method).toBe('POST');
      req.flush({
        players: [
          {
            player_id: 1,
            trikot_number: 4,
            player_firstname: 'Anna',
            player_name: 'Alt',
          },
        ],
        added_count: 1,
        skipped: [
          {
            player_id: 2,
            player_firstname: 'Dora',
            player_name: 'Dahl',
            trikot_number: 8,
            reason: 'kein Lizenzantrag für diese Mannschaft',
          },
        ],
        warnings: ['Lizenz von Anna Alt ist nicht erteilt (Status: beantragt)'],
        source_game: { id: 9, game_number: '17', date: '2026-01-10' },
      });
      fixture.detectChanges();

      expect(fixture.componentInstance.players.length).toBe(1);
      const panel: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="copy-result"]'
      );
      expect(panel.textContent).toContain('Nr. 17');
      expect(panel.textContent).toContain('10.01.2026');
      expect(panel.textContent).toContain('#8 Dora Dahl');
      expect(panel.textContent).toContain('nicht erteilt');
      // Nach der Übernahme ist die Aufstellung nicht mehr leer.
      expect(fixture.nativeElement.querySelector('fb-button')).toBeNull();
    });

    it('meldet, wenn es kein früheres Spiel gibt', () => {
      const fixture = open([]);

      fixture.componentInstance.copyFromLastGame();
      http.expectOne(copyUrl).flush({
        players: [],
        added_count: 0,
        skipped: [],
        warnings: [],
        source_game: null,
      });
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="copy-result"]')
          .textContent
      ).toContain('noch kein früheres Spiel');
    });

    it('lässt ein Altdatum ohne ISO-Form stehen', () => {
      const component =
        TestBed.createComponent(TeamSquadComponent).componentInstance;
      expect(component.formatSourceDate('2026-01-10')).toBe('10.01.2026');
      expect(component.formatSourceDate('11.08.2026')).toBe('11.08.2026');
      expect(component.formatSourceDate(null)).toBe('');
    });
  });
});
