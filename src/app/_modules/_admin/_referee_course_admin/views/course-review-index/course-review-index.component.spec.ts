import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import {
  ClubService,
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseImportService,
} from '@floorball/core';
import {
  RefereeCourseResult,
  StateAssociationWithClubs,
} from '@floorball/types';
import { CourseReviewIndexComponent } from './course-review-index.component';

// Die Freigabeübersicht des Landesverbands. Geprüft wird vor allem, ob eine
// Abweichung zwischen Datei und Datenbank sichtbar wird: Der Match-Score zählt
// sechs Merkmale, die Maske stellte lange nur drei davon dar -- Geburtsdatum,
// E-Mail und Verein fehlten, sodass ein Teilmatch fehlerfrei aussah.

function zeile(overrides: Partial<RefereeCourseResult> = {}) {
  return {
    id: 1,
    referee_course_import_id: 9,
    referee_id: 7882,
    state_association_id: 3,
    status: 'pending_review',
    match_type: 'partial_match',
    match_field_count: 5,
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
      geburtsdatum: null,
      verein: 'Unihockeyverein Zwigge 07 e.V.',
      email: 'paul@example.org',
    },
    lv_changes: {},
    course_data: {},
    new_referee_created: false,
    reviewed_by_user_id: null,
    reviewed_at: null,
    applied_at: null,
    referee_snapshot: {
      id: 7882,
      lizenznummer: 7940,
      vorname: 'Paul',
      nachname: 'Morgenroth',
      geburtsdatum: '2000-07-18',
      email: 'paul@example.org',
      club_id: 143,
      club_name: 'UV Zwigge 07',
    },
    matched_club: null,
    ...overrides,
  } as RefereeCourseResult;
}

describe('CourseReviewIndexComponent', () => {
  let component: CourseReviewIndexComponent;
  let importService: jasmine.SpyObj<RefereeCourseImportService>;
  let clubService: jasmine.SpyObj<ClubService>;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    importService = jasmine.createSpyObj('RefereeCourseImportService', [
      'listPendingResults',
      'approveResult',
    ]);
    importService.listPendingResults.and.returnValue(of([]));
    clubService = jasmine.createSpyObj('ClubService', ['getAdminClubs']);
    clubService.getAdminClubs.and.returnValue(of([]));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [CourseReviewIndexComponent],
      providers: [
        { provide: RefereeCourseImportService, useValue: importService },
        { provide: ClubService, useValue: clubService },
        { provide: NotificationService, useValue: notify },
      ],
    });
    component = TestBed.createComponent(
      CourseReviewIndexComponent
    ).componentInstance;
  });

  describe('Abweichungen zwischen Datei und Datenbank', () => {
    it('meldet keine Abweichung, wenn alle Merkmale übereinstimmen', () => {
      const r = zeile({
        csv: {
          lizenznummer: 7940,
          vorname: 'Paul',
          nachname: 'Morgenroth',
          geburtsdatum: '2000-07-18',
          verein: null,
          email: 'paul@example.org',
        },
      });

      expect(component.differingFields(r)).toEqual([]);
    });

    it('erkennt ein abweichendes Geburtsdatum', () => {
      const r = zeile({
        csv: { ...zeile().csv, geburtsdatum: '1999-01-02', verein: null },
      });

      expect(component.fieldsDiffer(r, 'geburtsdatum')).toBeTrue();
      expect(component.differingFields(r)).toEqual(['geburtsdatum']);
    });

    it('erkennt eine abweichende E-Mail unabhängig von der Schreibweise', () => {
      const gleich = zeile({
        csv: { ...zeile().csv, email: 'PAUL@example.ORG', verein: null },
      });
      const anders = zeile({
        csv: { ...zeile().csv, email: 'anders@example.org', verein: null },
      });

      expect(component.fieldsDiffer(gleich, 'email')).toBeFalse();
      expect(component.fieldsDiffer(anders, 'email')).toBeTrue();
    });

    // Gleiche Regel wie der Match-Score der API: Ein auf einer Seite leeres
    // Feld zählt als Treffer. Sonst widerspräche die Markierung der Zahl im
    // Kopf der Zeile.
    it('wertet ein in der Datei leeres Feld nicht als Abweichung', () => {
      const r = zeile({ csv: { ...zeile().csv, verein: null } });

      expect(r.csv.geburtsdatum).toBeNull();
      expect(component.fieldsDiffer(r, 'geburtsdatum')).toBeFalse();
    });

    it('meldet nichts, solange der Schiedsrichter nicht bekannt ist', () => {
      const r = zeile({ referee_snapshot: null, match_type: 'new_entry' });

      expect(component.differingFields(r)).toEqual([]);
    });
  });

  describe('Verein', () => {
    // Der häufigste Grund für einen Teilmatch: Der Abgleich beim Import nimmt
    // den Vereinsnamen exakt, „Unihockeyverein Zwigge 07 e.V." findet den
    // Verein „UV Zwigge 07" also nicht.
    it('meldet einen nicht zuordenbaren Vereinsnamen als Abweichung', () => {
      const r = zeile({ matched_club: null });

      expect(component.clubUnmatched(r)).toBeTrue();
      expect(component.fieldsDiffer(r, 'club')).toBeTrue();
      expect(component.differingFields(r)).toEqual(['club']);
    });

    it('meldet keine Abweichung, wenn der zugeordnete Verein der des Schiedsrichters ist', () => {
      const r = zeile({
        matched_club: {
          id: 143,
          name: 'UV Zwigge 07',
          state_association_id: 3,
        },
      });

      expect(component.clubUnmatched(r)).toBeFalse();
      expect(component.fieldsDiffer(r, 'club')).toBeFalse();
    });

    it('meldet eine Abweichung bei einem anderen zugeordneten Verein', () => {
      const r = zeile({
        matched_club: { id: 99, name: 'Anderer UV', state_association_id: 3 },
      });

      expect(component.fieldsDiffer(r, 'club')).toBeTrue();
    });

    it('meldet nichts, wenn der Schiedsrichter noch keinen Verein hat', () => {
      const r = zeile({
        referee_snapshot: { ...zeile().referee_snapshot!, club_id: null },
      });

      expect(component.fieldsDiffer(r, 'club')).toBeFalse();
    });

    it('zeigt den gewählten Verein, Bearbeitung schlägt den Serverwert', () => {
      const r = zeile();

      expect(component.selectedClubId(r)).toBe(143);

      component.setField(r, 'club_id', 99);
      expect(component.selectedClubId(r)).toBe(99);

      component.setField(r, 'club_id', null);
      expect(component.selectedClubId(r)).toBeNull();
    });
  });

  describe('Vereinsliste', () => {
    it('führt die Vereine aller Landesverbände flach und alphabetisch', () => {
      clubService.getAdminClubs.and.returnValue(
        of([
          { id: 1, name: 'LV Nord', clubs: [{ id: 2, name: 'UV Zwigge 07' }] },
          { id: 2, name: 'LV Süd', clubs: [{ id: 3, name: 'Anderer UV' }] },
        ] as unknown as StateAssociationWithClubs[])
      );

      component.loadClubs();

      expect(component.clubs.map((c) => c.name)).toEqual([
        'Anderer UV',
        'UV Zwigge 07',
      ]);
    });

    // Ohne Vereinsliste bleibt nur die Vereinsauswahl leer; die übrigen
    // Merkmale sind weiter bearbeitbar. Deshalb eine Meldung statt eines
    // stillen Fehlschlags, aber kein Abbruch.
    it('meldet einen Fehler, statt die Maske leer zu lassen', () => {
      clubService.getAdminClubs.and.returnValue(
        throwError(() => new Error('kaputt'))
      );

      component.loadClubs();

      expect(notify.error).toHaveBeenCalled();
      expect(component.clubs).toEqual([]);
    });
  });

  describe('Laden', () => {
    it('verwirft die zwischengespeicherten Abweichungen beim Neuladen', () => {
      const r = zeile({ matched_club: null });
      importService.listPendingResults.and.returnValue(of([r]));

      component.load();
      expect(component.differingFields(r)).toEqual(['club']);

      // Dieselbe Zeile, aber der Verein passt jetzt: Ohne das Leeren des
      // Zwischenspeichers stünde die Markierung von vorher noch da.
      const behoben = zeile({
        matched_club: {
          id: 143,
          name: 'UV Zwigge 07',
          state_association_id: 3,
        },
      });
      importService.listPendingResults.and.returnValue(of([behoben]));

      component.load();
      expect(component.differingFields(behoben)).toEqual([]);
    });
  });
});
