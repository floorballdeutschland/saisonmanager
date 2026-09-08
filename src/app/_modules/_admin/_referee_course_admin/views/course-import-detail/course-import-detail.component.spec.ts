import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseImportService,
  RefereeService,
} from '@floorball/core';
import {
  RefereeCourseImport,
  RefereeCourseImportWithResults,
  RefereeCourseResult,
  RefereeLicenseLevel,
} from '@floorball/types';
import { UikitCommonModule } from '@floorball/uikit/common';
import { CourseImportDetailComponent } from './course-import-detail.component';

// Die Importeurs-Maske. Kern der Prüfung: Eine zurückgestellte Zeile darf das
// Einreichen der übrigen nicht blockieren. Vorher hing der Knopf an ALLEN
// Zeilen — eine Zeile ohne Lizenzstufe sperrte die ganze Datei, und genau das
// ist der Fall, den das Zurückstellen aus dem Weg räumt.

function zeile(overrides: Partial<RefereeCourseResult> = {}) {
  return {
    id: 1,
    referee_course_import_id: 9,
    referee_id: 500,
    state_association_id: 3,
    status: 'pending_review',
    deferred: false,
    submitted_at: null,
    match_type: 'exact_match',
    match_field_count: 6,
    lizenzstufe: 'G',
    gueltigkeit: '2027-07-31',
    kursstichtag: '2026-08-01',
    master: {
      lizenznummer: 7940,
      vorname: 'Paul',
      nachname: 'Morgenroth',
      geburtsdatum: '2000-07-18',
      club_id: 143,
      email: 'paul@example.org',
    },
    master_by_importer: {
      lizenznummer: 7940,
      vorname: 'Paul',
      nachname: 'Morgenroth',
      geburtsdatum: '2000-07-18',
      club_id: 143,
      email: 'paul@example.org',
    },
    csv: {
      lizenznummer: 7940,
      vorname: 'Paul',
      nachname: 'Morgenroth',
      geburtsdatum: '2000-07-18',
      verein: 'UV Zwigge 07',
      email: 'paul@example.org',
    },
    lv_changes: {},
    course_data: {},
    new_referee_created: false,
    reviewed_by_user_id: null,
    reviewed_at: null,
    applied_at: null,
    ...overrides,
  } as RefereeCourseResult;
}

const STUFE_G: RefereeLicenseLevel = {
  id: 1,
  name: 'G',
  active: true,
  validity_years: 1,
};

function importMit(
  results: RefereeCourseResult[],
  overrides: Partial<RefereeCourseImportWithResults> = {}
) {
  return {
    id: 9,
    filename: 'kurs.csv',
    status: 'in_review',
    total_rows: results.length,
    uploaded_by_user_id: 1,
    created_at: '2026-09-08T10:00:00Z',
    results,
    ...overrides,
  } as RefereeCourseImportWithResults;
}

describe('CourseImportDetailComponent', () => {
  let component: CourseImportDetailComponent;
  let importService: jasmine.SpyObj<RefereeCourseImportService>;
  let refereeService: jasmine.SpyObj<RefereeService>;

  beforeEach(() => {
    importService = jasmine.createSpyObj('RefereeCourseImportService', [
      'getImport',
      'updateResult',
      'discardResult',
      'submitImport',
      'cancelImport',
    ]);
    importService.getImport.and.returnValue(of(importMit([])));
    refereeService = jasmine.createSpyObj('RefereeService', [
      'adminGetLicenseLevels',
    ]);
    refereeService.adminGetLicenseLevels.and.returnValue(of([STUFE_G]));

    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        UikitCommonModule,
        getTranslocoTestingModule(),
      ],
      declarations: [CourseImportDetailComponent],
      providers: [
        { provide: RefereeCourseImportService, useValue: importService },
        { provide: RefereeService, useValue: refereeService },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
          ]),
        },
        { provide: ActivatedRoute, useValue: { params: of({ id: '9' }) } },
        {
          provide: Router,
          useValue: jasmine.createSpyObj('Router', ['navigate']),
        },
      ],
    });
    const fixture = TestBed.createComponent(CourseImportDetailComponent);
    component = fixture.componentInstance;
    component.licenseLevels = [STUFE_G];
  });

  describe('Einreichen mit zurückgestellten Zeilen', () => {
    it('reicht ein, obwohl der zurückgestellten Zeile die Lizenzstufe fehlt', () => {
      component.importData = importMit([
        zeile({ id: 1 }),
        zeile({ id: 2, deferred: true, lizenzstufe: null }),
      ]);

      expect(component.canSubmit()).toBeTrue();
      expect(component.submittableCount()).toBe(1);
      expect(component.deferredCount()).toBe(1);
      // Die fehlende Stufe der zurückgestellten Zeile ist keine Baustelle
      // mehr — sonst stünde die rote Warnung unter einem freigegebenen Knopf.
      expect(component.missingLicenseLevelCount()).toBe(0);
    });

    it('blockiert, solange einer einreichbaren Zeile die Lizenzstufe fehlt', () => {
      component.importData = importMit([
        zeile({ id: 1, lizenzstufe: null }),
        zeile({ id: 2, deferred: true }),
      ]);

      expect(component.canSubmit()).toBeFalse();
      expect(component.missingLicenseLevelCount()).toBe(1);
    });

    it('blockiert, wenn alle offenen Zeilen zurückgestellt sind', () => {
      component.importData = importMit([zeile({ id: 1, deferred: true })]);

      expect(component.submittableCount()).toBe(0);
      expect(component.canSubmit()).toBeFalse();
    });

    // Die schon eingereichten Zeilen eines teilweise eingereichten Imports
    // gehören dem Landesverband. Zählte der Knopf sie mit, würde er einen
    // zweiten Durchlauf über sie versprechen.
    it('zählt die schon eingereichten Zeilen nicht mit', () => {
      component.importData = importMit(
        [
          zeile({ id: 1, submitted_at: '2026-09-08T11:00:00Z' }),
          zeile({ id: 2, deferred: true }),
        ],
        { status: 'partially_submitted' }
      );

      expect(component.submittableCount()).toBe(0);
      expect(component.canSubmit()).toBeFalse();
    });

    it('nimmt eine nachgereichte Zeile wieder mit', () => {
      component.importData = importMit(
        [
          zeile({ id: 1, submitted_at: '2026-09-08T11:00:00Z' }),
          zeile({ id: 2 }),
        ],
        { status: 'partially_submitted' }
      );

      expect(component.canSubmit()).toBeTrue();
      expect(component.submittableCount()).toBe(1);
    });

    it('lädt nach dem Einreichen neu, weil die Antwort keine Zeilen trägt', () => {
      component.importData = importMit([zeile({ id: 1 })]);
      importService.submitImport.and.returnValue(
        of({
          id: 9,
          filename: 'kurs.csv',
          status: 'partially_submitted',
          total_rows: 1,
          uploaded_by_user_id: 1,
          created_at: '2026-09-08T10:00:00Z',
        } as RefereeCourseImport)
      );
      importService.getImport.calls.reset();

      component.submit();

      expect(importService.getImport).toHaveBeenCalledWith(9);
    });
  });

  describe('Bearbeitbarkeit je Zeile', () => {
    it('lässt die zurückgestellte Zeile eines teilweise eingereichten Imports bearbeiten', () => {
      const offen = zeile({ id: 2, deferred: true });
      component.importData = importMit([offen], {
        status: 'partially_submitted',
      });

      expect(component.isEditable()).toBeTrue();
      expect(component.isRowEditable(offen)).toBeTrue();
    });

    it('sperrt die eingereichte Zeile', () => {
      const eingereicht = zeile({
        id: 1,
        submitted_at: '2026-09-08T11:00:00Z',
      });
      component.importData = importMit([eingereicht], {
        status: 'partially_submitted',
      });

      expect(component.isRowEditable(eingereicht)).toBeFalse();
    });

    it('sperrt alles, sobald der Import vollständig eingereicht ist', () => {
      const r = zeile({ id: 1, submitted_at: '2026-09-08T11:00:00Z' });
      component.importData = importMit([r], { status: 'submitted' });

      expect(component.isEditable()).toBeFalse();
      expect(component.isRowEditable(r)).toBeFalse();
    });
  });

  describe('Zurückstellen und Verwerfen', () => {
    it('schickt das Zurückstellen als Änderung der Zeile', () => {
      const r = zeile({ id: 3 });
      component.importData = importMit([r]);
      importService.updateResult.and.returnValue(
        of(zeile({ id: 3, deferred: true }))
      );

      component.toggleDeferred(r);

      expect(importService.updateResult).toHaveBeenCalledWith(3, {
        deferred: true,
      });
    });

    it('nimmt eine zurückgestellte Zeile wieder auf', () => {
      const r = zeile({ id: 3, deferred: true });
      component.importData = importMit([r]);
      importService.updateResult.and.returnValue(of(zeile({ id: 3 })));

      component.toggleDeferred(r);

      expect(importService.updateResult).toHaveBeenCalledWith(3, {
        deferred: false,
      });
    });

    // Das Verwerfen der letzten offenen Zeile schließt den Import ab: Der
    // Status im Kopf der Seite ändert sich mit, die Zeile allein zu ersetzen
    // würde ihn stehen lassen.
    it('lädt nach dem Verwerfen neu', () => {
      const r = zeile({ id: 4, deferred: true });
      component.importData = importMit([r], {
        status: 'partially_submitted',
      });
      importService.discardResult.and.returnValue(
        of(zeile({ id: 4, status: 'rejected', deferred: false }))
      );
      importService.getImport.calls.reset();

      component.discard(r);

      expect(importService.discardResult).toHaveBeenCalledWith(4);
      expect(importService.getImport).toHaveBeenCalledWith(9);
    });

    it('erkennt eine verworfene Zeile', () => {
      expect(
        component.isDiscarded(zeile({ status: 'rejected', submitted_at: null }))
      ).toBeTrue();
      // Vom Landesverband zurückgewiesen, nicht vom Importeur verworfen: Die
      // Zeile war eingereicht.
      expect(
        component.isDiscarded(
          zeile({ status: 'rejected', submitted_at: '2026-09-08T11:00:00Z' })
        )
      ).toBeFalse();
    });
  });
});
