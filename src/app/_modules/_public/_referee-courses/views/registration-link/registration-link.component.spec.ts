import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  RefereeCourseSignupService,
} from '@floorball/core';
import { RegistrationLinkComponent } from './registration-link.component';

describe('RegistrationLinkComponent', () => {
  function render(kind: 'confirm' | 'cancel', late = false) {
    const service = jasmine.createSpyObj('RefereeCourseSignupService', [
      'registrationLink',
      'submitRegistrationLink',
    ]);
    service.registrationLink.and.returnValue(
      of({
        name: 'Neu Ling',
        status: 'registered',
        late,
        course: { id: 7, title: 'G-Kurs', sessions: [] },
      })
    );
    service.submitRegistrationLink.and.returnValue(
      of({ status: 'cancelled_by_participant', late_cancellation: late })
    );
    TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule()],
      declarations: [RegistrationLinkComponent],
      providers: [
        { provide: RefereeCourseSignupService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ token: 'tok' }),
              data: { kind },
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(RegistrationLinkComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  const el = (root: HTMLElement, test: string) =>
    root.querySelector(`[data-test="${test}"]`);

  it('handelt erst auf Knopfdruck', () => {
    const { fixture, service } = render('confirm');
    expect(service.registrationLink).toHaveBeenCalledWith('confirm', 'tok');
    expect(service.submitRegistrationLink).not.toHaveBeenCalled();
    (el(fixture.nativeElement, 'submit') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.submitRegistrationLink).toHaveBeenCalledWith(
      'confirm',
      'tok'
    );
    expect(el(fixture.nativeElement, 'done')).not.toBeNull();
  });

  it('warnt bei der Abmeldung nach der Frist', () => {
    const { fixture } = render('cancel', true);
    expect(el(fixture.nativeElement, 'late')).not.toBeNull();
  });
});
