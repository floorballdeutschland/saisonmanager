import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseService,
} from '@floorball/core';
import { CourseBillingComponent } from './course-billing.component';

describe('CourseBillingComponent', () => {
  function render(nationalAllowed = false) {
    const service = jasmine.createSpyObj('RefereeCourseService', [
      'options',
      'billingPreview',
      'billingCreate',
      'billingExports',
      'billingDownload',
    ]);
    service.options.and.returnValue(
      of({
        state_associations: [{ id: 3, name: 'Hessen' }],
        partner_state_associations: [],
        national_allowed: nationalAllowed,
        license_levels: [],
        course_types: [],
      })
    );
    service.billingPreview.and.returnValue(
      of({
        headers: ['Vorname', 'Betrag'],
        rows: [
          { registration_id: 1, values: ['Ada', '25,00'], warnings: [] },
          {
            registration_id: 2,
            values: ['Bo', '25,00'],
            warnings: ['Verein ohne Kontakt-E-Mail'],
          },
        ],
        row_count: 2,
        total_cents: 5000,
        waiting_for_license: ['Kim Klein'],
      })
    );
    service.billingExports.and.returnValue(of([]));
    service.billingCreate.and.returnValue(
      of({ id: 9, state_association: null, row_count: 2, total_cents: 5000 })
    );
    service.billingDownload.and.returnValue(of(new Blob(['x'])));
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [CourseBillingComponent],
      providers: [
        { provide: RefereeCourseService, useValue: service },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', ['success']),
        },
      ],
    });
    const fixture = TestBed.createComponent(CourseBillingComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  it('laedt die Vorschau fuer den eigenen LV und zaehlt Warnungen', () => {
    const { fixture, service } = render();
    const c = fixture.componentInstance;
    expect(c.stateAssociationId).toBe(3);
    expect(service.billingPreview.calls.mostRecent().args[0]).toEqual({
      state_association_id: 3,
      from: null,
      to: null,
      include_billed: false,
    });
    expect(c.warningCount).toBe(1);
    expect(
      fixture.nativeElement.querySelector('[data-test="waiting"]')
    ).not.toBeNull();
  });

  it('erzeugt den Export erst nach Rueckfrage', () => {
    const { fixture, service } = render();
    const confirmSpy = spyOn(window, 'confirm').and.returnValues(false, true);
    fixture.componentInstance.createExport();
    expect(service.billingCreate).not.toHaveBeenCalled();
    fixture.componentInstance.createExport();
    expect(service.billingCreate).toHaveBeenCalled();
    expect(service.billingDownload).toHaveBeenCalledWith(9);
    expect(confirmSpy).toHaveBeenCalledTimes(2);
  });
});
