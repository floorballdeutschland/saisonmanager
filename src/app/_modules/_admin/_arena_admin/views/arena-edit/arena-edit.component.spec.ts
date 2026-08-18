import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ArenaService, NotificationService } from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { Arena } from '@floorball/types';

import { ArenaEditComponent } from './arena-edit.component';

// Inaktiver Bestandsspielort: steht in der Liste, fehlt aber im Spieltag,
// weil der Spielplan nur Arena.active anbietet (#451).
const INACTIVE: Arena = {
  id: 7,
  name: 'Sporthalle Rohrdorf',
  city: 'Rohrdorf',
  active: false,
};

describe('ArenaEditComponent', () => {
  let service: jasmine.SpyObj<ArenaService>;

  const createComponent = (arenaId?: string) => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { params: arenaId ? { arenaId } : {} } },
    });
    const fixture = TestBed.createComponent(ArenaEditComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<ArenaService>('ArenaService', [
      'getAdminArenas',
      'createArena',
      'updateArena',
    ]);
    service.getAdminArenas.and.returnValue(of([INACTIVE]));
    service.createArena.and.returnValue(of(INACTIVE));
    service.updateArena.and.returnValue(of(INACTIVE));

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, getTranslocoTestingModule()],
      declarations: [ArenaEditComponent],
      providers: [
        { provide: ArenaService, useValue: service },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj<NotificationService>(
            'NotificationService',
            ['success', 'error']
          ),
        },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
      ],
    })
      .overrideTemplate(ArenaEditComponent, '')
      .compileComponents();
  });

  it('uebernimmt den Aktiv-Zustand des Spielorts', () => {
    expect(createComponent('7').active).toBeFalse();
  });

  it('schickt den umgeschalteten Zustand beim Speichern mit', () => {
    const component = createComponent('7');

    component.active = true;
    component.submit();

    expect(service.updateArena).toHaveBeenCalledWith(
      7,
      jasmine.objectContaining({ active: true })
    );
  });

  // Beim Anlegen setzt die API `active` selbst (#449). Käme das Feld aus dem
  // Formular mit, hinge der Zustand eines neuen Spielorts wieder am Frontend.
  it('schickt beim Anlegen kein active mit', () => {
    const component = createComponent();

    component.name = 'Neue Halle';
    component.city = 'Berlin';
    component.submit();

    const payload = service.createArena.calls.mostRecent().args[0];
    expect('active' in payload).toBeFalse();
  });
});
