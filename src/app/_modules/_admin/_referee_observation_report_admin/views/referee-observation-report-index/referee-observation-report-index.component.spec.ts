import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AssociationService, RefereeObservationService } from '@floorball/core';
import {
  RefereeObservation,
  RefereeObservationReport,
  Season,
} from '@floorball/types';
import { RefereeObservationSharedModule } from '@floorball/referee-observation';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { RefereeObservationReportIndexComponent } from './referee-observation-report-index.component';

describe('RefereeObservationReportIndexComponent', () => {
  let fixture: ComponentFixture<RefereeObservationReportIndexComponent>;
  let component: RefereeObservationReportIndexComponent;
  let service: jasmine.SpyObj<RefereeObservationService>;

  function observation(
    id: number,
    overrides: Partial<RefereeObservation> = {}
  ): RefereeObservation {
    return {
      id,
      game_id: 100 + id,
      game_number: `${id}`,
      date: '2026-10-04',
      home_team: 'Heim',
      guest_team: 'Gast',
      league: 'Liga',
      league_id: 7,
      game_operation_slug: 'fd',
      coach_id: 9,
      coach_name: 'Cem Coach',
      status: 'visible',
      submitted_at: '2026-10-04T18:00:00Z',
      assigned_as_coach: true,
      match_description: 'Kopf-an-Kopf.',
      stick_play_comment: 'Einheitlich.',
      physical_play_comment: 'Frueh eingefangen.',
      penalty_line_comment: 'Nachvollziehbar.',
      game_management_comment: 'Ruhig.',
      other_matters: 'Nichts.',
      final_comments: 'Kommunikation ausbauen.',
      pair_stick_play_rating: 5,
      pair_physical_play_rating: 5,
      pair_penalty_line_rating: 4,
      pair_game_management_rating: 5,
      pair_overall_rating: 5,
      ratings: [
        {
          referee_id: 22,
          referee_name: 'Bo Pfiff',
          position: 2,
          stick_play_rating: 3,
          physical_play_rating: 3,
          penalty_line_rating: 3,
          game_management_rating: 3,
          overall_rating: 3,
        },
        {
          referee_id: 11,
          referee_name: 'Anna Schiri',
          position: 1,
          stick_play_rating: 6,
          physical_play_rating: 6,
          penalty_line_rating: 6,
          game_management_rating: 6,
          overall_rating: 6,
        },
      ],
      ...overrides,
    };
  }

  function report(
    observations: RefereeObservation[]
  ): RefereeObservationReport {
    return {
      filters: { status: 'visible' },
      options: {
        coaches: [{ id: 9, name: 'Cem Coach' }],
        referees: [
          { id: 11, name: 'Anna Schiri' },
          { id: 22, name: 'Bo Pfiff' },
        ],
        game_operations: [{ id: 1, name: 'Floorball Deutschland' }],
      },
      observations,
    };
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<RefereeObservationService>(
      'RefereeObservationService',
      ['adminGetReport', 'adminExportReport']
    );
    service.adminGetReport.and.returnValue(
      of(report([observation(1), observation(2, { status: 'hidden' })]))
    );
    service.adminExportReport.and.returnValue(of(new Blob(['x'])));

    const seasons$ = new BehaviorSubject<Season[]>([
      { id: 17, name: '2025/2026', current: false },
      { id: 18, name: '2026/2027', current: true },
    ]);

    await TestBed.configureTestingModule({
      declarations: [RefereeObservationReportIndexComponent],
      imports: [
        FormsModule,
        RouterModule.forRoot([]),
        RefereeObservationSharedModule,
        getTranslocoTestingModule(),
      ],
      providers: [
        { provide: RefereeObservationService, useValue: service },
        { provide: AssociationService, useValue: { seasons$ } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeObservationReportIndexComponent);
    component = fixture.componentInstance;
    // Der Download klickt einen Link an; im Test darf er nichts herunterladen.
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(HTMLAnchorElement.prototype, 'click');
    fixture.detectChanges();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('lädt beim Start nur sichtbare Bögen und listet sie', () => {
    expect(service.adminGetReport).toHaveBeenCalledWith({ status: 'visible' });
    expect(el().querySelectorAll('[data-test="observation-row"]').length).toBe(
      2
    );
    expect(el().querySelectorAll('[data-test="hidden-badge"]').length).toBe(1);
  });

  it('nennt die Schiedsrichter in Gespann-Reihenfolge', () => {
    expect(component.refereeNames(observation(1))).toBe(
      'Anna Schiri, Bo Pfiff'
    );
  });

  it('schickt die gesetzten Filter mit', () => {
    component.filterSeasonId = '18';
    component.filterCoachId = 9;
    component.filterRefereeId = 11;
    component.filterStatus = 'all';
    component.filterFrom = '2026-10-01';
    component.load();

    expect(service.adminGetReport).toHaveBeenCalledWith({
      status: 'all',
      season_id: '18',
      coach_id: 9,
      referee_id: 11,
      from: '2026-10-01',
    });
  });

  it('exportiert ohne Auswahl alle gefilterten Bögen', () => {
    component.export('csv');
    expect(service.adminExportReport).toHaveBeenCalledWith(
      'csv',
      { status: 'visible' },
      []
    );
  });

  it('exportiert mit Auswahl nur die ausgewählten Bögen', () => {
    component.toggleSelected(2);
    fixture.detectChanges();
    expect(
      el().querySelector('[data-test="export-scope"]')?.textContent
    ).toContain('export.selected');

    component.export('xlsx');
    expect(service.adminExportReport).toHaveBeenCalledWith(
      'xlsx',
      { status: 'visible' },
      [2]
    );
  });

  it('wählt alle aus und wieder ab', () => {
    component.toggleAll();
    expect(component.allSelected).toBeTrue();
    expect([...component.selected]).toEqual([1, 2]);
    component.toggleAll();
    expect(component.selected.size).toBe(0);
  });

  // Sonst exportierte ein neuer Filter still Bögen aus dem vorigen, die gar
  // nicht mehr in der Liste stehen.
  it('verwirft die Auswahl beim Neuladen', () => {
    component.toggleSelected(1);
    component.load();
    expect(component.selected.size).toBe(0);
  });

  it('klappt einen Bogen auf und zeigt ihn vollständig', () => {
    const toggle = el().querySelector<HTMLButtonElement>(
      '[data-test="toggle-detail"]'
    )!;
    toggle.click();
    fixture.detectChanges();

    expect(el().querySelector('fb-referee-observation-detail')).not.toBeNull();
    expect(el().textContent).toContain('Kommunikation ausbauen.');
  });

  it('formatiert das Spieldatum deutsch', () => {
    expect(component.formatDate('2026-10-04')).toBe('04.10.2026');
    expect(component.formatDate(null)).toBe('');
  });
});
