import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RefereeObservationService } from '@floorball/core';
import { RefereeObservation } from '@floorball/types';
import { ObservationReceivedComponent } from './observation-received.component';

describe('ObservationReceivedComponent', () => {
  let component: ObservationReceivedComponent;
  let service: jasmine.SpyObj<RefereeObservationService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<RefereeObservationService>(
      'RefereeObservationService',
      ['getReceived']
    );
    component = new ObservationReceivedComponent(service, {
      markForCheck: () => undefined,
    } as unknown as ChangeDetectorRef);
  });

  it('zeigt die erhaltenen Rueckmeldungen', () => {
    service.getReceived.and.returnValue(
      of([{ id: 5 } as RefereeObservation])
    );
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
});
