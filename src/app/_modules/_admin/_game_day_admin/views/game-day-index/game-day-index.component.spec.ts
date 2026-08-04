import { getTranslocoTestingModule } from '@floorball/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { GameDayReportRow } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { GameDayIndexComponent } from './game-day-index.component';

describe('GameDayIndexComponent', () => {
  let component: GameDayIndexComponent;
  let httpMock: HttpTestingController;

  // Ohne detectChanges läuft ngOnInit nicht: Die Tests prüfen Gruppierung,
  // Filter und Aktionen, nicht das Laden von Saisons und Spielbetrieben.
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule(), HttpClientTestingModule],
      declarations: [GameDayIndexComponent],
    })
      .overrideTemplate(GameDayIndexComponent, '')
      .compileComponents();

    component = TestBed.createComponent(
      GameDayIndexComponent
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

  it('holt die Scan-URL erst beim Öffnen', () => {
    const openSpy = spyOn(window, 'open');
    component.openScan(row({ id: 42 }));

    httpMock
      .expectOne(environment.apiURL + 'user/games/42/scan.json')
      .flush({ url: 'https://example.test/scan.pdf' });

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.test/scan.pdf',
      '_blank',
      'noopener'
    );
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

  it('merkt sich die Kürzung der Serverantwort', () => {
    loadWith([row()], true);
    expect(component.truncated).toBeTrue();
  });
});
