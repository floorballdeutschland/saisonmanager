import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import {
  RefereeFeedbackService,
  RefereeObservationService,
} from '@floorball/core';
import {
  RefereeFeedbackOwnSummary,
  RefereeObservation,
} from '@floorball/types';
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
