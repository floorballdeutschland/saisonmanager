import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { RefereeService } from '@floorball/core';
import { RefereeVm } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

import { RefereeVmIndexComponent } from './referee-vm-index.component';

const referee = (overrides: Partial<RefereeVm> = {}): RefereeVm => ({
  id: 12,
  lizenznummer: 4711,
  lizenznummer_display: '4711',
  vorname: 'Ida',
  nachname: 'Muster',
  email: 'ida@example.org',
  has_user: true,
  active: true,
  qualifications: [],
  ...overrides,
});

describe('RefereeVmIndexComponent', () => {
  let fixture: ComponentFixture<RefereeVmIndexComponent>;

  const setup = (referees: RefereeVm[]) => {
    const service = jasmine.createSpyObj<RefereeService>('RefereeService', [
      'vmGetReferees',
    ]);
    service.vmGetReferees.and.returnValue(of(referees));

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        // Global unter dem Alias, siehe referee-vm-detail.component.spec.ts.
        getTranslocoTestingModule({
          de: {
            refereeVm: {
              accountHint: 'Konto beim LV anfragen',
              index: { hasAccountBadge: 'Konto' },
            },
          },
        }),
      ],
      declarations: [RefereeVmIndexComponent],
      providers: [{ provide: RefereeService, useValue: service }],
    });
    fixture = TestBed.createComponent(RefereeVmIndexComponent);
    fixture.detectChanges();
  };

  const el = () => fixture.nativeElement as HTMLElement;

  it('verlinkt den Namen auf die Detailansicht und zeigt die E-Mail', () => {
    setup([referee()]);

    expect(
      el().querySelector('a[href="/verwaltung/schiedsrichter-verein/12"]')
    ).not.toBeNull();
    expect(el().textContent).toContain('ida@example.org');
  });

  it('zeigt das Konto-Badge nur bei vorhandenem Konto', () => {
    setup([referee(), referee({ id: 13, has_user: false })]);

    const rows = el().querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Konto');
    expect(rows[1].textContent).not.toContain('Konto');
  });

  it('erklärt den Weg zum Konto nur, wenn jemand ohne Konto dabei ist', () => {
    setup([referee()]);
    expect(el().textContent).not.toContain('Konto beim LV anfragen');

    TestBed.resetTestingModule();
    setup([referee({ has_user: false })]);
    expect(el().textContent).toContain('Konto beim LV anfragen');
  });
});
