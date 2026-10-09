import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import {
  getTranslocoTestingModule,
  RefereeCourseSignupService,
} from '@floorball/core';
import { CourseGuardianConsentComponent } from './course-guardian-consent.component';

describe('CourseGuardianConsentComponent', () => {
  function render(info$: Observable<unknown>) {
    const service = jasmine.createSpyObj('RefereeCourseSignupService', [
      'guardianConsent',
      'confirmGuardianConsent',
    ]);
    service.guardianConsent.and.returnValue(info$);
    service.confirmGuardianConsent.and.returnValue(
      of({ status: 'registered' })
    );
    TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule()],
      declarations: [CourseGuardianConsentComponent],
      providers: [
        { provide: RefereeCourseSignupService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ token: 'tok' }) },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CourseGuardianConsentComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  const el = (root: HTMLElement, test: string) =>
    root.querySelector(`[data-test="${test}"]`);

  it('willigt erst auf Knopfdruck ein', () => {
    const { fixture, service } = render(
      of({
        name: 'Kim Klein',
        club: 'TV Kassel',
        course: { title: 'J-Kurs', sessions: [] },
      })
    );
    expect(service.guardianConsent).toHaveBeenCalledWith('tok');
    expect(service.confirmGuardianConsent).not.toHaveBeenCalled();

    (el(fixture.nativeElement, 'confirm') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.confirmGuardianConsent).toHaveBeenCalledWith('tok');
    expect(el(fixture.nativeElement, 'done')).not.toBeNull();
  });

  it('zeigt einen ungueltigen Link an', () => {
    const { fixture } = render(throwError(() => ({ status: 404 })));
    expect(el(fixture.nativeElement, 'invalid')).not.toBeNull();
  });

  it('zeigt bei einem Serverfehler nicht „Link ungueltig“', () => {
    const { fixture } = render(throwError(() => ({ status: 500 })));
    expect(el(fixture.nativeElement, 'failed')).not.toBeNull();
    expect(el(fixture.nativeElement, 'invalid')).toBeNull();
  });
});
