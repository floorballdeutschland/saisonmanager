import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { GameService } from '@floorball/core';
import { ChecklistVeto } from '@floorball/types';

import { ChecklistVetoComponent } from './checklist-veto.component';

describe('ChecklistVetoComponent', () => {
  let component: ChecklistVetoComponent;
  let fixture: ComponentFixture<ChecklistVetoComponent>;
  let gameService: jasmine.SpyObj<GameService>;

  const veto = (overrides: Partial<ChecklistVeto> = {}): ChecklistVeto => ({
    already_submitted: false,
    game_number: '101',
    home_team_name: 'Heim',
    guest_team_name: 'Gast',
    date: '2026-01-10',
    original_answers: [
      { item_id: 1, question: 'Halle bespielbar?', answer: true },
      { item_id: 2, question: 'Zeitnehmer gestellt?', answer: false },
    ],
    checklist_items: [
      { id: 1, question: 'Halle bespielbar?' },
      { id: 2, question: 'Zeitnehmer gestellt?' },
    ],
    ...overrides,
  });

  function setup(queryParams: Record<string, string> = { token: 'tok' }) {
    gameService = jasmine.createSpyObj('GameService', [
      'getChecklistVeto',
      'submitChecklistVeto',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [ChecklistVetoComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: GameService, useValue: gameService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ gameId: '55' }),
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(ChecklistVetoComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should prefill the answers with what the match officials stated', () => {
    setup();
    gameService.getChecklistVeto.and.returnValue(of(veto()));

    component.ngOnInit();

    expect(gameService.getChecklistVeto).toHaveBeenCalledWith(55, 'tok');
    expect(component.answers).toEqual({ 1: true, 2: false });
    // Unveränderter Ausgangsstand: vollständig, aber kein Einspruch.
    expect(component.complete()).toBeTrue();
    expect(component.changed()).toBeFalse();
  });

  it('should treat a changed answer as an objection', () => {
    setup();
    gameService.getChecklistVeto.and.returnValue(of(veto()));
    component.ngOnInit();

    component.setAnswer(2, true);

    expect(component.changed()).toBeTrue();
  });

  it('should stay incomplete while an unanswered question is left over', () => {
    setup();
    gameService.getChecklistVeto.and.returnValue(
      of(
        veto({
          original_answers: [
            { item_id: 1, question: 'Halle bespielbar?', answer: true },
          ],
        })
      )
    );

    component.ngOnInit();

    expect(component.answers).toEqual({ 1: true });
    expect(component.complete()).toBeFalse();
    expect(component.originalAnswer(2)).toBeNull();
  });

  it('should submit every question, not only the changed ones', () => {
    setup();
    gameService.getChecklistVeto.and.returnValue(of(veto()));
    gameService.submitChecklistVeto.and.returnValue(of({ success: true }));
    component.ngOnInit();

    component.setAnswer(2, true);
    component.submit();

    expect(gameService.submitChecklistVeto).toHaveBeenCalledWith(55, 'tok', [
      { item_id: 1, question: 'Halle bespielbar?', answer: true },
      { item_id: 2, question: 'Zeitnehmer gestellt?', answer: true },
    ]);
    expect(component.done).toBeTrue();
  });

  it('should not submit while a question is unanswered', () => {
    setup();
    gameService.getChecklistVeto.and.returnValue(
      of(veto({ original_answers: [] }))
    );
    component.ngOnInit();

    component.submit();

    expect(gameService.submitChecklistVeto).not.toHaveBeenCalled();
  });

  it('should surface the server message when submitting fails', () => {
    setup();
    gameService.getChecklistVeto.and.returnValue(of(veto()));
    gameService.submitChecklistVeto.and.returnValue(
      throwError(() => ({
        error: { error: 'Ein Einspruch wurde bereits eingereicht.' },
      }))
    );
    component.ngOnInit();

    component.submit();

    expect(component.errorMessage).toBe(
      'Ein Einspruch wurde bereits eingereicht.'
    );
    expect(component.done).toBeFalse();
    expect(component.submitting).toBeFalse();
  });

  it('should mark the link invalid when the request fails', () => {
    setup();
    gameService.getChecklistVeto.and.returnValue(
      throwError(() => ({ status: 401 }))
    );

    component.ngOnInit();

    expect(component.invalid).toBeTrue();
    expect(component.loading).toBeFalse();
  });

  it('should not call the api without a token', () => {
    setup({});

    component.ngOnInit();

    expect(gameService.getChecklistVeto).not.toHaveBeenCalled();
    expect(component.invalid).toBeTrue();
  });
});
