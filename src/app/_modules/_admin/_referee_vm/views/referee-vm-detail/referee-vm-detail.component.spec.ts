import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { RefereeService } from '@floorball/core';
import { RefereeAdminGame, RefereeVm } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

import { RefereeVmDetailComponent } from './referee-vm-detail.component';

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

const game: RefereeAdminGame = {
  id: 7,
  game_number: '10',
  date: '2026-09-01',
  home_team: 'Heim',
  guest_team: 'Gast',
  league: 'Regionalliga',
  league_id: 5,
  game_operation_slug: 'sbk-ost',
  season_id: 18,
};

describe('RefereeVmDetailComponent', () => {
  let fixture: ComponentFixture<RefereeVmDetailComponent>;
  let service: jasmine.SpyObj<RefereeService>;

  const setup = (result: RefereeVm | 'error') => {
    service = jasmine.createSpyObj<RefereeService>('RefereeService', [
      'vmGetReferee',
      'vmGetGames',
    ]);
    service.vmGetReferee.and.returnValue(
      result === 'error' ? throwError(() => ({ status: 404 })) : of(result)
    );
    service.vmGetGames.and.returnValue(of([game]));

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        // Global unter dem Alias: Ohne sein Modul bekommt die Komponente den
        // Scope im TestBed nicht, Scope-Schlüssel blieben wirkungslos.
        getTranslocoTestingModule({
          de: {
            refereeVm: {
              accountHint: 'Konto beim LV anfragen',
              detail: { notFound: 'Nicht gefunden' },
            },
          },
        }),
      ],
      declarations: [RefereeVmDetailComponent],
      providers: [
        { provide: RefereeService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { id: '12' } } },
        },
      ],
    });
    fixture = TestBed.createComponent(RefereeVmDetailComponent);
    fixture.detectChanges();
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('lädt Schiri und Einsätze über die Vereins-Endpunkte', () => {
    setup(referee());

    expect(service.vmGetReferee).toHaveBeenCalledWith(12);
    expect(service.vmGetGames).toHaveBeenCalledWith(12);
    expect(text()).toContain('ida@example.org');
    expect(text()).toContain('Heim');
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a[href="/sbk-ost/5/spiel/7"]'
    );
    expect(link).not.toBeNull();
  });

  it('zeigt ohne Konto den Hinweis auf die Schiedsrichterkommission', () => {
    setup(referee({ has_user: false }));

    expect(text()).toContain('Konto beim LV anfragen');
  });

  it('zeigt mit Konto keinen Hinweis', () => {
    setup(referee({ has_user: true }));

    expect(text()).not.toContain('Konto beim LV anfragen');
  });

  it('meldet einen fremden Schiri als nicht gefunden', () => {
    setup('error');

    expect(text()).toContain('Nicht gefunden');
    expect(service.vmGetGames).not.toHaveBeenCalled();
  });
});
