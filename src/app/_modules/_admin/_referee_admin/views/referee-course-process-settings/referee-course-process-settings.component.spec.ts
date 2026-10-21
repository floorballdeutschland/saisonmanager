import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseImportService,
  StateAssociationService,
} from '@floorball/core';
import {
  RefereeCourseProcessSettings,
  StateAssociation,
} from '@floorball/types';
import { RefereeCourseProcessSettingsComponent } from './referee-course-process-settings.component';

// Schalter fuer CSV-Import und Kurse im System in den Schiri-Einstellungen.

describe('RefereeCourseProcessSettingsComponent', () => {
  const VORGABE: RefereeCourseProcessSettings = {
    csv_import_enabled: true,
    courses_enabled: false,
    courses_state_association_ids: [],
    open_import_rows: 4,
  };
  const LV = [
    { id: 7, name: 'Sachsen' },
    { id: 3, name: 'Bayern' },
  ] as StateAssociation[];

  function render(settings: RefereeCourseProcessSettings = VORGABE) {
    const service = jasmine.createSpyObj('RefereeCourseImportService', [
      'getProcessSettings',
      'updateProcessSettings',
    ]);
    service.getProcessSettings.and.returnValue(of(settings));
    service.updateProcessSettings.and.callFake(
      (patch: Partial<RefereeCourseProcessSettings>) =>
        of({ ...settings, ...patch })
    );
    const saService = jasmine.createSpyObj('StateAssociationService', [
      'adminGetAll',
    ]);
    saService.adminGetAll.and.returnValue(of(LV));

    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [RefereeCourseProcessSettingsComponent],
      providers: [
        { provide: RefereeCourseImportService, useValue: service },
        { provide: StateAssociationService, useValue: saService },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', ['success']),
        },
      ],
    });
    const fixture = TestBed.createComponent(
      RefereeCourseProcessSettingsComponent
    );
    fixture.detectChanges();
    return { fixture, service };
  }

  function el(root: HTMLElement, test: string): HTMLElement | null {
    return root.querySelector(`[data-test="${test}"]`);
  }

  async function klick(
    fixture: ReturnType<typeof render>['fixture'],
    test: string
  ) {
    // ngModel schreibt den Startwert erst nach einem Microtask ins Feld; ein
    // Klick davor schaltet vom leeren Kaestchen aus.
    await fixture.whenStable();
    (el(fixture.nativeElement, test) as HTMLInputElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('zeigt die Vorgabe und sortiert die Landesverbaende nach Namen', () => {
    const { fixture } = render();
    const c = fixture.componentInstance;

    expect(c.draft?.csv_import_enabled).toBeTrue();
    expect(c.draft?.courses_enabled).toBeFalse();
    expect(c.stateAssociations.map((s) => s.name)).toEqual([
      'Bayern',
      'Sachsen',
    ]);
    expect(c.dirty).toBeFalse();
  });

  it('nennt offene Importzeilen erst, wenn der Import ausgeschaltet wird', async () => {
    const { fixture } = render();
    expect(el(fixture.nativeElement, 'open-import-rows')).toBeNull();

    await klick(fixture, 'csv-import-enabled');

    expect(el(fixture.nativeElement, 'open-import-rows')).not.toBeNull();
  });

  it('warnt, wenn beide Wege aus sind', async () => {
    const { fixture } = render();

    await klick(fixture, 'csv-import-enabled');

    expect(el(fixture.nativeElement, 'both-off')).not.toBeNull();
  });

  it('zeigt die LV-Auswahl nur bei eingeschalteten Kursen und speichert sie', async () => {
    const { fixture, service } = render();
    expect(el(fixture.nativeElement, 'sa-7')).toBeNull();

    await klick(fixture, 'courses-enabled');
    await klick(fixture, 'sa-7');
    await klick(fixture, 'save');

    expect(service.updateProcessSettings).toHaveBeenCalledWith({
      csv_import_enabled: true,
      courses_enabled: true,
      courses_state_association_ids: [7],
    });
    expect(fixture.componentInstance.dirty).toBeFalse();
  });

  it('verwirft ungespeicherte Aenderungen', async () => {
    const { fixture } = render();

    await klick(fixture, 'csv-import-enabled');
    expect(fixture.componentInstance.dirty).toBeTrue();
    fixture.componentInstance.reset();

    expect(fixture.componentInstance.draft?.csv_import_enabled).toBeTrue();
    expect(fixture.componentInstance.dirty).toBeFalse();
  });
});
