import { CommonModule, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ChangeDetectorRef, LOCALE_ID, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  RefereeFeedbackService,
  RefereeObservationService,
} from '@floorball/core';
import {
  RefereeFeedbackOwnSummary,
  RefereeObservation,
} from '@floorball/types';
import { getTranslocoTestingModule } from '../../../_core/_i18n/transloco-testing';
import { ObservationReceivedComponent } from './observation-received.component';

describe('ObservationReceivedComponent', () => {
  let component: ObservationReceivedComponent;
  let service: jasmine.SpyObj<RefereeObservationService>;
  let feedbackService: jasmine.SpyObj<RefereeFeedbackService>;

  const summary = (
    over: Partial<RefereeFeedbackOwnSummary> = {}
  ): RefereeFeedbackOwnSummary => ({
    count: 6,
    min_count: 5,
    avg_line_rating: 7.2,
    avg_communication_rating: 6.8,
    ...over,
  });

  beforeEach(() => {
    service = jasmine.createSpyObj<RefereeObservationService>(
      'RefereeObservationService',
      ['getReceived']
    );
    feedbackService = jasmine.createSpyObj<RefereeFeedbackService>(
      'RefereeFeedbackService',
      ['getOwnSummary']
    );
    service.getReceived.and.returnValue(of([]));
    feedbackService.getOwnSummary.and.returnValue(of(summary()));
    component = new ObservationReceivedComponent(service, feedbackService, {
      markForCheck: () => undefined,
    } as unknown as ChangeDetectorRef);
  });

  it('zeigt die erhaltenen Rueckmeldungen', () => {
    service.getReceived.and.returnValue(of([{ id: 5 } as RefereeObservation]));
    component.ngOnInit();

    expect(component.observations.length).toBe(1);
    expect(component.loading).toBeFalse();
    expect(component.failed).toBeFalse();
  });

  it('meldet einen Ladefehler, statt dauerhaft zu laden', () => {
    service.getReceived.and.returnValue(throwError(() => new Error('kaputt')));
    component.ngOnInit();

    expect(component.failed).toBeTrue();
    expect(component.loading).toBeFalse();
  });

  it('zeigt die Durchschnitte der Mannschaften ab der Mindestzahl', () => {
    component.ngOnInit();

    expect(component.teamLoading).toBeFalse();
    expect(component.hasTeamAverages).toBeTrue();
  });

  it('zeigt unter der Mindestzahl keine Durchschnitte', () => {
    feedbackService.getOwnSummary.and.returnValue(
      of(
        summary({
          count: 3,
          avg_line_rating: null,
          avg_communication_rating: null,
        })
      )
    );
    component.ngOnInit();

    expect(component.teamSummary?.count).toBe(3);
    expect(component.hasTeamAverages).toBeFalse();
  });

  it('haelt die Abschnitte getrennt, wenn das Team-Feedback nicht laedt', () => {
    service.getReceived.and.returnValue(of([{ id: 5 } as RefereeObservation]));
    feedbackService.getOwnSummary.and.returnValue(
      throwError(() => new Error('kaputt'))
    );
    component.ngOnInit();

    expect(component.teamFailed).toBeTrue();
    expect(component.teamLoading).toBeFalse();
    expect(component.failed).toBeFalse();
    expect(component.observations.length).toBe(1);
  });
});

describe('ObservationReceivedComponent (Darstellung)', () => {
  let fixture: ComponentFixture<ObservationReceivedComponent>;
  let feedbackService: jasmine.SpyObj<RefereeFeedbackService>;

  beforeAll(() => registerLocaleData(localeDe));

  beforeEach(async () => {
    const service = jasmine.createSpyObj<RefereeObservationService>(
      'RefereeObservationService',
      ['getReceived']
    );
    feedbackService = jasmine.createSpyObj<RefereeFeedbackService>(
      'RefereeFeedbackService',
      ['getOwnSummary']
    );
    service.getReceived.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [CommonModule, getTranslocoTestingModule()],
      declarations: [ObservationReceivedComponent],
      providers: [
        { provide: LOCALE_ID, useValue: 'de' },
        { provide: RefereeObservationService, useValue: service },
        { provide: RefereeFeedbackService, useValue: feedbackService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  const render = (summary: RefereeFeedbackOwnSummary) => {
    feedbackService.getOwnSummary.and.returnValue(of(summary));
    fixture = TestBed.createComponent(ObservationReceivedComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('formatiert die Durchschnitte wie die Auswertung (Komma, eine Stelle)', () => {
    const el = render({
      count: 6,
      min_count: 5,
      avg_line_rating: 7,
      avg_communication_rating: 6.8,
    });
    const text = el.querySelector('[data-test="team-summary"]')?.textContent;

    expect(text).toContain('7,0');
    expect(text).toContain('6,8');
    expect(el.querySelector('[data-test="team-below-threshold"]')).toBeNull();
  });

  it('zeigt unter der Mindestzahl keine Kacheln', () => {
    const el = render({
      count: 3,
      min_count: 5,
      avg_line_rating: null,
      avg_communication_rating: null,
    });

    expect(el.querySelector('[data-test="team-summary"]')).toBeNull();
    expect(
      el.querySelector('[data-test="team-below-threshold"]')
    ).not.toBeNull();
  });
});
