import { getTranslocoTestingModule } from '@floorball/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { GameDayReportRow, GameReportStatus } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { MatchReportIndexComponent } from './match-report-index.component';

describe('MatchReportIndexComponent', () => {
  let component: MatchReportIndexComponent;
  let httpMock: HttpTestingController;

  // Ohne detectChanges läuft ngOnInit nicht: Die Tests prüfen Gruppierung,
  // Filter und Aktionen, nicht das Laden von Saisons und Spielbetrieben.
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule(), HttpClientTestingModule],
      declarations: [MatchReportIndexComponent],
    })
      .overrideTemplate(MatchReportIndexComponent, '')
      .compileComponents();

    component = TestBed.createComponent(
      MatchReportIndexComponent
    ).componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function row(overrides: Partial<GameDayReportRow> = {}): GameDayReportRow {
    return {
      id: 1,
      game_number: '10',
      start_time: '18:00',
      game_day_id: 100,
      game_day_number: 1,
      date: '2026-02-01',
      league_id: 5,
      league_name: 'Regionalliga',
      game_operation_slug: 'sbk-ost',
      arena_name: 'Halle',
      hosting_club_name: 'Verein',
      home_team: 'Heim',
      guest_team: 'Gast',
      result_string: '3:2',
      game_status: 'match_record_closed',
      record_created_at: '2026-02-01T19:00:00Z',
      record_updated_at: '2026-02-01T20:30:00Z',
      record_updated_by_name: 'Anna Muster',
      match_record_closed_at: '2026-02-01T20:35:00Z',
      record_comment: null,
      scan_required: false,
      scan: null,
      referee_report: null,
      proceeding_proposal: null,
      checklist_negative_count: 0,
      checklist_veto_submitted_at: null,
      checklist_veto_negative_count: 0,
      flags: {
        protest: false,
        forfait: false,
        special_event_string: null,
        severe_penalty_count: 0,
        missing_audience: false,
        missing_signatures: false,
        missing_referee2: false,
      },
      ...overrides,
    };
  }

  function loadWith(rows: GameDayReportRow[], truncated = false) {
    component['_load']();
    const req = httpMock.expectOne(
      (r) =>
        r.url === environment.apiURL + 'admin/game_days/report_overview.json'
    );
    req.flush({ truncated, games: rows });
  }

  it('gruppiert Spiele nach Spieltag und zählt abgeschlossene Berichte', () => {
    loadWith([
      row({ id: 1, game_day_id: 100, game_status: 'finalized' }),
      row({ id: 2, game_day_id: 100, game_status: 'aftergame' }),
      row({ id: 3, game_day_id: 200, game_status: 'match_record_closed' }),
    ]);

    expect(component.groups.length).toBe(2);
    const first = component.groups[0];
    expect(first.gameDayId).toBe(100);
    expect(first.games.length).toBe(2);
    expect(first.closedCount).toBe(1);
  });

  it('zählt Hinweise an die SBK je Spieltag', () => {
    loadWith([
      row({ id: 1, record_comment: 'Zeitnehmer fehlte' }),
      row({ id: 2, record_comment: null }),
    ]);

    expect(component.groups[0].commentCount).toBe(1);
  });

  it('filtert auf offene Berichte', () => {
    component.filterStatus = 'open';
    loadWith([
      row({ id: 1, game_status: 'finalized' }),
      row({ id: 2, game_status: 'match_record_closed' }),
      row({ id: 3, game_status: 'ingame' }),
      row({ id: 4, game_status: null }),
    ]);

    expect(component.rows.map((r) => r.id)).toEqual([3, 4]);
  });

  it('filtert auf Spiele mit Hinweis an die SBK', () => {
    component.filterStatus = 'withComment';
    loadWith([
      row({ id: 1, record_comment: 'Bitte prüfen' }),
      row({ id: 2, record_comment: null }),
    ]);

    expect(component.rows.map((r) => r.id)).toEqual([1]);
  });

  it('erkennt Auffälligkeiten und verknüpfte Vorgänge', () => {
    const withPenalty = row({
      flags: { ...row().flags, severe_penalty_count: 1 },
    });
    const withProposal = row({
      proceeding_proposal: { id: 7, status: 'pending' },
    });

    expect(component.hasFlags(withPenalty)).toBeTrue();
    expect(component.hasFlags(row())).toBeFalse();
    expect(component.hasLinkedRecords(withProposal)).toBeTrue();
    expect(component.hasLinkedRecords(row())).toBeFalse();
  });

  it('bietet den Abschluss nur für zur Kontrolle freigegebene Berichte an', () => {
    expect(
      component.canFinalize(row({ game_status: 'match_record_closed' }))
    ).toBeTrue();
    expect(
      component.canFinalize(row({ game_status: 'finalized' }))
    ).toBeFalse();
    expect(
      component.canFinalize(row({ game_status: 'aftergame' }))
    ).toBeFalse();
  });

  it('setzt den Status lokal auf finalized, ohne neu zu laden', () => {
    loadWith([row({ id: 1, game_status: 'match_record_closed' })]);
    const target = component.rows[0];

    component.finalizeGame(target);
    httpMock
      .expectOne(environment.apiURL + 'user/games/1/game_status.json')
      .flush({});

    expect(target.game_status).toBe('finalized');
    expect(component.groups[0].closedCount).toBe(1);
    expect(component.finalizingGameId).toBeNull();
  });

  it('öffnet den Tab synchron und füllt die Scan-URL nach', () => {
    // Der Tab muss im Klick-Handler aufgehen, sonst greift der Popup-Blocker.
    // Die URL steht erst nach dem Request fest und wird nachgereicht.
    const tab = { location: { href: '' }, close: jasmine.createSpy('close') };
    const openSpy = spyOn(window, 'open').and.returnValue(
      tab as unknown as Window
    );

    component.openScan(row({ id: 42 }));
    expect(openSpy).toHaveBeenCalledWith('', '_blank', 'noopener');

    httpMock
      .expectOne(environment.apiURL + 'user/games/42/scan.json')
      .flush({ url: 'https://example.test/scan.pdf' });

    expect(tab.location.href).toBe('https://example.test/scan.pdf');
    expect(tab.close).not.toHaveBeenCalled();
    expect(component.scanLoadingGameId).toBeNull();
  });

  it('schließt den leeren Tab, wenn kein Scan vorliegt', () => {
    const tab = { location: { href: '' }, close: jasmine.createSpy('close') };
    spyOn(window, 'open').and.returnValue(tab as unknown as Window);

    component.openScan(row({ id: 42 }));
    httpMock
      .expectOne(environment.apiURL + 'user/games/42/scan.json')
      .flush(null);

    expect(tab.close).toHaveBeenCalled();
    expect(component.scanLoadingGameId).toBeNull();
  });

  it('baut den Link auf den Spielbericht nur mit Slug und Liga', () => {
    expect(component.gameRouterLink(row())).toEqual([
      '/',
      'sbk-ost',
      5,
      'spiel',
      1,
    ]);
    expect(
      component.gameRouterLink(row({ game_operation_slug: null }))
    ).toBeNull();
  });

  it('fragt ohne Saison-Parameter ab', () => {
    // Die Saison ist serverseitig fest auf die laufende gebunden; ein Parameter
    // hier würde nur vortäuschen, Altsaisons wären erreichbar.
    component['_load']();
    const req = httpMock.expectOne(
      (r) =>
        r.url === environment.apiURL + 'admin/game_days/report_overview.json'
    );
    expect(req.request.params.has('season_id')).toBeFalse();
    req.flush({ truncated: false, games: [] });
  });

  it('merkt sich die Kürzung der Serverantwort', () => {
    loadWith([row()], true);
    expect(component.truncated).toBeTrue();
  });

  it('zählt den vollständigen Spieltag, auch wenn der Statusfilter greift', () => {
    // Sonst meldete ein Spieltag unter „Noch nicht abgeschlossen" stets 0/n.
    component.filterStatus = 'open';
    loadWith([
      row({ id: 1, game_day_id: 100, game_status: 'finalized' }),
      row({ id: 2, game_day_id: 100, game_status: 'finalized' }),
      row({ id: 3, game_day_id: 100, game_status: 'aftergame' }),
    ]);

    const group = component.groups[0];
    expect(group.totalCount).toBe(3);
    expect(group.closedCount).toBe(2);
    expect(group.games.map((g) => g.id)).toEqual([3]);
  });

  it('blendet Spieltage ohne passende Spiele aus', () => {
    component.filterStatus = 'withComment';
    loadWith([
      row({ id: 1, game_day_id: 100, record_comment: 'Hinweis' }),
      row({ id: 2, game_day_id: 200, record_comment: null }),
    ]);

    expect(component.groups.map((g) => g.gameDayId)).toEqual([100]);
  });

  it('lädt bei reiner Statusänderung nicht neu', () => {
    loadWith([
      row({ id: 1, game_status: 'finalized' }),
      row({ id: 2, game_status: 'aftergame' }),
    ]);

    component.filterStatus = 'open';
    component.applyFilter();
    // httpMock.verify() in afterEach schlägt fehl, wenn doch ein Request rausging.
    expect(component.rows.map((r) => r.id)).toEqual([2]);
  });

  it('entfernt die Zeile nach dem Abschließen aus dem Offen-Filter', () => {
    component.filterStatus = 'open';
    loadWith([row({ id: 1, game_status: 'match_record_closed' })]);
    expect(component.rows.length).toBe(0);

    component.filterStatus = '';
    component.applyFilter();
    const target = component.rows[0];
    component.filterStatus = 'open';
    component.applyFilter();
    component.filterStatus = '';
    component.applyFilter();

    component.finalizeGame(target);
    httpMock
      .expectOne(environment.apiURL + 'user/games/1/game_status.json')
      .flush({});

    component.filterStatus = 'open';
    component.applyFilter();
    expect(component.rows.length).toBe(0);
  });

  it('setzt die Sperre nach einem Fehler beim Abschließen zurück', () => {
    // Sonst blieben ALLE Abschließen-Knöpfe der Liste dauerhaft deaktiviert.
    loadWith([row({ id: 1, game_status: 'match_record_closed' })]);

    component.finalizeGame(component.rows[0]);
    httpMock
      .expectOne(environment.apiURL + 'user/games/1/game_status.json')
      .flush(
        { message: 'Schiedsrichter fehlt' },
        { status: 422, statusText: 'Unprocessable' }
      );

    expect(component.finalizingGameId).toBeNull();
    expect(component.rows[0].game_status).toBe('match_record_closed');
  });

  it('gibt den Scan-Knopf nach einem Fehler wieder frei', () => {
    const tab = { location: { href: '' }, close: jasmine.createSpy('close') };
    spyOn(window, 'open').and.returnValue(tab as unknown as Window);
    component.openScan(row({ id: 42 }));
    httpMock
      .expectOne(environment.apiURL + 'user/games/42/scan.json')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.scanLoadingGameId).toBeNull();
  });

  it('überlebt eine Zeile ohne flags-Objekt', () => {
    // Der Server markiert nicht ladbare Zeilen ohne `flags`; ein Wurf hier würde
    // den Ladevorgang stumm abbrechen und die Seite auf „lädt" stehen lassen.
    const broken = { id: 9, game_day_id: 100 } as unknown as GameDayReportRow;
    loadWith([broken]);

    expect(component.loading).toBeFalse();
    expect(component.hasFlags(broken)).toBeFalse();
  });

  it('kennt für jeden Status ein Label', () => {
    for (const status of [
      null,
      'pregame',
      'ingame',
      'aftergame',
      'match_record_closed',
      'finalized',
    ] as (GameReportStatus | null)[]) {
      expect(component.statusLabel(status)).toBeTruthy();
      expect(component.statusClass(status)).toContain('bg-');
    }
  });

  it('paginiert über die gefilterten Zeilen', () => {
    loadWith(
      Array.from({ length: 26 }, (_, i) => row({ id: i + 1, game_day_id: i }))
    );

    expect(component.numberOfPages).toBe(2);
    expect(component.pagedRows.length).toBe(25);
    component.changePage(2);
    expect(component.pagedRows.length).toBe(1);
  });
});
