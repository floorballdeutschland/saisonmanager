import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
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

// Gegenstueck zum inaktiven Eintrag: Ohne beide Zustaende im Bestand liesse
// sich nicht unterscheiden, ob das Haekchen den Spielort abbildet oder nur den
// DOM-Default einer frischen Checkbox zeigt.
const ACTIVE: Arena = {
  id: 8,
  name: 'Halle am Park',
  city: 'Berlin',
  active: true,
};

describe('ArenaEditComponent', () => {
  let service: jasmine.SpyObj<ArenaService>;

  // Die Route wird ueber ein veraenderliches Objekt gestellt, nicht per
  // overrideProvider: Das laesst sich nur einmal je TestBed aufrufen, und ein
  // Test vergleicht die Maske zum Anlegen mit der zum Bearbeiten.
  const routeParams: Record<string, string> = {};

  const createFixture = (arenaId?: string) => {
    for (const key of Object.keys(routeParams)) delete routeParams[key];
    if (arenaId) routeParams['arenaId'] = arenaId;
    const fixture = TestBed.createComponent(ArenaEditComponent);
    fixture.detectChanges();
    return fixture;
  };

  const createComponent = (arenaId?: string) =>
    createFixture(arenaId).componentInstance;

  const activeCheckbox = (
    fixture: ComponentFixture<ArenaEditComponent>
  ): HTMLInputElement | null =>
    fixture.nativeElement.querySelector('input[name="active"]');

  beforeEach(async () => {
    service = jasmine.createSpyObj<ArenaService>('ArenaService', [
      'getAdminArenas',
      'createArena',
      'updateArena',
    ]);
    service.getAdminArenas.and.returnValue(of([INACTIVE, ACTIVE]));
    service.createArena.and.returnValue(of(INACTIVE));
    service.updateArena.and.returnValue(of(INACTIVE));

    await TestBed.configureTestingModule({
      imports: [
        FormsModule,
        RouterTestingModule,
        // Global unter dem Alias, weil der Scope `admin/arena` ohne das
        // AdminArenaModule nicht aufloest (siehe arena-index.component.spec.ts).
        getTranslocoTestingModule({
          de: {
            arena: {
              edit: {
                active: 'Im Spieltag zur Auswahl anbieten',
                activeHint: 'Inaktive Spielorte tauchen im Spieltag nicht auf.',
              },
            },
          },
        }),
      ],
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
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: routeParams } },
        },
      ],
    }).compileComponents();
  });

  it('uebernimmt den Aktiv-Zustand des Spielorts', fakeAsync(() => {
    const fixture = createFixture('7');
    // ngModel schreibt Model -> View erst im Microtask. Ohne den Flush liest
    // `checked` den DOM-Default false, und die Zusicherung koennte selbst dann
    // nicht fehlschlagen, wenn die Bindung ganz fehlte.
    tick();

    expect(fixture.componentInstance.active).toBeFalse();
    expect(activeCheckbox(fixture)!.checked).toBeFalse();
  }));

  it('zeigt das Haekchen bei einem aktiven Spielort gesetzt', fakeAsync(() => {
    const fixture = createFixture('8');
    tick();

    expect(fixture.componentInstance.active).toBeTrue();
    expect(activeCheckbox(fixture)!.checked).toBeTrue();
  }));

  // Haelt die Uebersetzungstabelle fest: Loeste der Alias nicht auf, stuende
  // hier der rohe Key, und keine andere Zusicherung im Spec wuerde es merken.
  it('beschriftet das Haekchen', () => {
    const label = createFixture('7').nativeElement.querySelector(
      'input[name="active"]'
    ).parentElement as HTMLElement;

    expect(label.textContent!.trim()).toBe('Im Spieltag zur Auswahl anbieten');
  });

  // Beim Anlegen setzt die API `active` selbst (#449). Stuende das Haekchen
  // schon dort, sae es aus, als entschiede das Formular darueber.
  it('zeigt das Haekchen nur beim Bearbeiten', () => {
    expect(activeCheckbox(createFixture('7'))).not.toBeNull();
    expect(activeCheckbox(createFixture())).toBeNull();
  });

  it('schreibt das Haekchen in den Zustand der Komponente', fakeAsync(() => {
    const fixture = createFixture('7');
    tick();

    const checkbox = activeCheckbox(fixture)!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.active).toBeTrue();
  }));

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
