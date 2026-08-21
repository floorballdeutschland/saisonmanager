import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { getTranslocoTestingModule } from '@floorball/core';
import { environment } from 'src/environments/environment';
import { Team } from 'src/app/_models';
import { TeamIndexComponent } from './team-index.component';

const CUP_LEAGUE_ID = 42;

function team(overrides: Partial<Team>): Team {
  return {
    id: 1,
    name: 'Berlin Rockets',
    short_name: 'BER',
    league_id: 7,
    cup_leagues: [],
    club_id: 3,
    syndicate: false,
    syndicate_clubs: [],
    logo_url: '',
    logo_small: '',
    ...overrides,
  } as Team;
}

describe('TeamIndexComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [TeamIndexComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ leagueId: `${CUP_LEAGUE_ID}` }) },
        },
      ],
    })
      .overrideTemplate(TeamIndexComponent, '')
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  function createComponent(): TeamIndexComponent {
    const fixture = TestBed.createComponent(TeamIndexComponent);
    // detectChanges statt nur createComponent: ngOnInit liest die leagueId aus
    // der Route, und ohne die kennt die Komponente den Wettbewerb nicht.
    fixture.detectChanges();
    // Liga-Mannschaften und Ligaliste werden beim Init geladen. Bewusst je Aufruf
    // die passende Form: Die Ligaliste ist ein Array, ein pauschales {} laesst
    // die Komponente an groups.flatMap scheitern.
    http
      .match(() => true)
      .forEach((r) => {
        r.flush(r.request.url.endsWith('admin/leagues.json') ? [] : {});
      });
    return fixture.componentInstance;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('blendet Mannschaften aus, die schon zum Wettbewerb gehoeren', () => {
    const component = createComponent();
    component.addSourceLeagueId = 7;

    component.onSourceLeagueChange();

    http.expectOne(`${environment.apiURL}admin/leagues/7/teams.json`).flush({
      teams: [
        team({ id: 1, name: 'Frei' }),
        team({ id: 2, name: 'Schon im Pokal', cup_leagues: [CUP_LEAGUE_ID] }),
        team({
          id: 3,
          name: 'Hauptliga ist der Pokal',
          league_id: CUP_LEAGUE_ID,
        }),
      ],
    });

    expect(component.candidateTeams.map((t) => t.id)).toEqual([1]);
  });

  it('schickt die ausgewaehlten Mannschaften an den Aufnahme-Endpoint', () => {
    const component = createComponent();
    component.selectedTeamIds = [5, 9];

    component.addTeams();

    const req = http.expectOne(
      `${environment.apiURL}admin/leagues/${CUP_LEAGUE_ID}/add_existing_teams.json`
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ team_ids: [5, 9] });
    req.flush({ added: 2, skipped: 0, failed: 0 });

    expect(component.addResult?.added).toBe(2);
    expect(component.selectedTeamIds).toEqual([]);
  });

  // Der Neuaufbau der Kandidatenliste nach einer Aufnahme darf die Rueckmeldung
  // nicht wegwischen – sonst sieht niemand, was passiert ist.
  it('behaelt die Rueckmeldung, wenn danach die Kandidatenliste neu laedt', () => {
    const component = createComponent();
    component.addSourceLeagueId = 7;
    component.selectedTeamIds = [5];

    component.addTeams();
    http
      .expectOne(
        `${environment.apiURL}admin/leagues/${CUP_LEAGUE_ID}/add_existing_teams.json`
      )
      .flush({ added: 1, skipped: 0, failed: 0 });

    expect(component.addResult?.added).toBe(1);
  });

  it('verwirft die Rueckmeldung beim Wechsel der Quell-Liga', () => {
    const component = createComponent();
    component.addResult = { added: 1, skipped: 0, failed: 0 };
    component.addSourceLeagueId = null;

    component.onSourceLeagueChange();

    expect(component.addResult).toBeNull();
  });

  it('nimmt ohne Auswahl keine Anfrage vor', () => {
    const component = createComponent();
    component.selectedTeamIds = [];

    component.addTeams();

    http.expectNone(
      `${environment.apiURL}admin/leagues/${CUP_LEAGUE_ID}/add_existing_teams.json`
    );
    expect(component.adding).toBeFalse();
  });

  it('erkennt Gastmannschaften an ihrer fremden Hauptliga', () => {
    const component = createComponent();

    expect(component.isGuestTeam(team({ league_id: 7 }))).toBeTrue();
    expect(
      component.isGuestTeam(team({ league_id: CUP_LEAGUE_ID }))
    ).toBeFalse();
  });

  it('entfernt eine Gastmannschaft nur aus dem Wettbewerb', () => {
    const component = createComponent();

    component.removeTeam(team({ id: 8, league_id: 7 }));

    const req = http.expectOne(
      `${environment.apiURL}admin/leagues/${CUP_LEAGUE_ID}/existing_teams/8.json`
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ removed: true });
  });

  it('ruehrt eine Mannschaft der eigenen Hauptliga nicht an', () => {
    const component = createComponent();

    component.removeTeam(team({ id: 8, league_id: CUP_LEAGUE_ID }));

    http.expectNone(
      `${environment.apiURL}admin/leagues/${CUP_LEAGUE_ID}/existing_teams/8.json`
    );
    expect(component.removingTeamId).toBeNull();
  });

  it('schaltet die Auswahl einer Mannschaft um', () => {
    const component = createComponent();

    component.toggleTeam(4, { target: { checked: true } } as unknown as Event);
    expect(component.selectedTeamIds).toEqual([4]);
    expect(component.isSelected(4)).toBeTrue();

    component.toggleTeam(4, { target: { checked: false } } as unknown as Event);
    expect(component.selectedTeamIds).toEqual([]);
  });

  afterEach(() => {
    // Der Reload nach Aufnahme/Entfernen laeuft noch offen mit.
    http.match(() => true).forEach((r) => r.flush({}));
    http.verify();
  });
});
