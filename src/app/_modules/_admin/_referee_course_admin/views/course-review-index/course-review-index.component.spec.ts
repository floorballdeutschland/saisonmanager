import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import {
  ClubService,
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseImportService,
} from '@floorball/core';
import { Club, RefereeCourseResult } from '@floorball/types';
import { UikitCommonModule } from '@floorball/uikit/common';
import { CourseReviewIndexComponent } from './course-review-index.component';

// Die Freigabeübersicht des Landesverbands. Geprüft wird vor allem, ob eine
// Abweichung zwischen Datei und Datenbank sichtbar wird. Der Match-Score zählt
// sechs Merkmale; die Spalte „Datenbank" war nur für drei davon befüllt
// (Geburtsdatum und E-Mail lieferte die API nicht mit), und der Verein fehlte
// als Zeile ganz. Ein Teilmatch sah damit fehlerfrei aus.

const ZWIGGE = { id: 143, name: 'UV Zwigge 07', state_association_id: 3 };

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
    // Der Import setzt den Verein des Schiedsrichters als Rückfallwert, wenn
    // der Name aus der Datei keinen Verein trifft. Genau diese Lage.
    matched_club: ZWIGGE,
    csv_club_match: null,
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
    clubService = jasmine.createSpyObj('ClubService', ['getAdminClubAll']);
    clubService.getAdminClubAll.and.returnValue(of([]));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        // Das echte UIKit-Modul, nicht NO_ERRORS_SCHEMA: `fb-select-search` in
        // der Vereinszeile ist ein ControlValueAccessor, ohne ihn scheitert
        // `[ngModel]` beim Rendern.
        UikitCommonModule,
        // Echte Texte für die Render-Tests. Die Komponente steht hier ohne ihr
        // Modul und damit ohne dessen TRANSLOCO_SCOPE, deshalb lösen
        // Scope-Schlüssel wie `admin/referee-course` nicht auf: Die Keys müssen
        // global unter dem Alias stehen, den das Modul vergibt.
        getTranslocoTestingModule({
          de: {
            refereeCourseAdmin: {
              detail: {
                dash: '—',
                clubUnmatched: '„{{ name }}" (nicht zugeordnet)',
              },
            },
          },
        }),
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

    // Wie `RefereeCourseResult.field_match?` in der API, die vor dem Vergleich
    // `strip` anwendet. Bestandsdaten mit Namensrändern gibt es.
    it('wertet ein Randleerzeichen nicht als Abweichung', () => {
      const r = zeile({
        csv: { ...zeile().csv, nachname: '  Morgenroth ', verein: null },
      });

      expect(component.fieldsDiffer(r, 'nachname')).toBeFalse();
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
      const r = zeile({ csv_club_match: null });

      expect(component.clubUnmatched(r)).toBeTrue();
      expect(component.fieldsDiffer(r, 'club')).toBeTrue();
      expect(component.differingFields(r)).toEqual(['club']);
    });

    // Der Fall, an dem die erste Fassung vorbeilief: Trifft der Name nicht,
    // trägt `matched_club` den Verein des Schiedsrichters. Wer damit
    // vergleicht, sieht Gleichheit, obwohl der Score den Verein als
    // Nicht-Treffer zählt. Maßgeblich ist deshalb `csv_club_match`.
    it('meldet die Abweichung, obwohl der finale Verein sein Verein ist', () => {
      const r = zeile({ matched_club: ZWIGGE, csv_club_match: null });

      expect(r.matched_club!.id).toBe(r.referee_snapshot!.club_id!);
      expect(component.fieldsDiffer(r, 'club')).toBeTrue();
    });

    it('meldet keine Abweichung, wenn der Namenstreffer sein Verein ist', () => {
      const r = zeile({ csv_club_match: ZWIGGE });

      expect(component.clubUnmatched(r)).toBeFalse();
      expect(component.fieldsDiffer(r, 'club')).toBeFalse();
    });

    it('meldet eine Abweichung bei einem anderen Namenstreffer', () => {
      const r = zeile({
        csv_club_match: { id: 99, name: 'Anderer UV', state_association_id: 3 },
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
    it('sortiert die Vereine alphabetisch', () => {
      clubService.getAdminClubAll.and.returnValue(
        of([
          { id: 2, name: 'UV Zwigge 07' },
          { id: 3, name: 'Anderer UV' },
        ] as Club[])
      );

      component.loadClubs();

      expect(component.clubs.map((c) => c.name)).toEqual([
        'Anderer UV',
        'UV Zwigge 07',
      ]);
      expect(component.clubsUnavailable).toBeFalse();
    });

    // `getAdminClubs` wertet nur Admin- und SBK-Rechte aus und antwortet einem
    // reinen LV-RSK mit einer leeren Liste und Status 200. Genau der ist die
    // Zielgruppe dieser Maske, ein Fehlerzweig springt dabei nie an.
    it('fragt den Endpunkt ab, den ein LV-RSK lesen darf', () => {
      component.loadClubs();

      expect(clubService.getAdminClubAll).toHaveBeenCalled();
    });

    // Ohne Vereinsliste bleiben die übrigen Merkmale bearbeitbar, die
    // Vereinsauswahl wird aber gesperrt: Ein Enter im leeren Feld schriebe
    // sonst „kein Verein" und entfernte den Verein beim Schiedsrichter.
    it('meldet einen Fehler und sperrt die Auswahl', () => {
      clubService.getAdminClubAll.and.returnValue(
        throwError(() => new Error('kaputt'))
      );

      component.loadClubs();

      expect(notify.error).toHaveBeenCalled();
      expect(component.clubs).toEqual([]);
      expect(component.clubsUnavailable).toBeTrue();
    });

    it('sperrt die Auswahl auch bei einer leeren Antwort ohne Fehler', () => {
      clubService.getAdminClubAll.and.returnValue(of([]));

      component.loadClubs();

      expect(component.clubsUnavailable).toBeTrue();
    });
  });

  describe('Freigeben', () => {
    it('entfernt die Zeile und meldet den Erfolg', () => {
      const r = zeile();
      importService.listPendingResults.and.returnValue(of([r]));
      importService.approveResult.and.returnValue(of(r));
      component.load();

      component.approve(r);

      expect(component.results).toEqual([]);
      expect(component.approving.has(r.id)).toBeFalse();
      expect(notify.success).toHaveBeenCalled();
    });

    // Der 422 des Import-Guards heißt, dass diese Zeile nicht mehr in die
    // Warteschlange gehört. Ohne das Neuladen behauptete der Bildschirm weiter,
    // hier gäbe es etwas freizugeben, und jeder weitere Klick liefe erneut auf.
    it('lädt nach dem 422 des Import-Guards neu', () => {
      const r = zeile();
      importService.listPendingResults.and.returnValue(of([r]));
      component.load();
      importService.approveResult.and.returnValue(
        throwError(() => ({
          status: 422,
          error: { error: 'nicht eingereicht' },
        }))
      );
      importService.listPendingResults.calls.reset();
      importService.listPendingResults.and.returnValue(of([]));

      component.approve(r);

      expect(importService.listPendingResults).toHaveBeenCalled();
      expect(component.results).toEqual([]);
      expect(component.approving.has(r.id)).toBeFalse();
    });

    // Den Toast stellt der ErrorInterceptor; ein zweiter aus der Komponente
    // legte pro Klick eine doppelte, einzeln wegzuklickende Meldung obendrauf.
    it('meldet den Fehler nicht selbst noch einmal', () => {
      const r = zeile();
      importService.approveResult.and.returnValue(
        throwError(() => ({
          status: 422,
          error: { error: 'nicht eingereicht' },
        }))
      );

      component.approve(r);

      expect(notify.error).not.toHaveBeenCalled();
    });
  });

  // Der PR behebt eine Lücke in der Maske, nicht in der Logik: Die Vereinszeile
  // fehlte im Template ganz, Geburtsdatum und E-Mail zeigten einen Platzhalter.
  // Ein Test auf die Komponentenlogik allein würde ein Entfernen dieser Zeilen
  // nicht bemerken.
  describe('Darstellung', () => {
    function render(r: RefereeCourseResult) {
      importService.listPendingResults.and.returnValue(of([r]));
      const fixture = TestBed.createComponent(CourseReviewIndexComponent);
      fixture.detectChanges();
      return fixture;
    }

    it('zeigt Geburtsdatum, E-Mail und Verein aus der Datenbank', () => {
      const text = render(zeile())
        .debugElement.queryAll(By.css('td'))
        .map((td) => td.nativeElement.textContent.trim())
        .join(' | ');

      expect(text).toContain('2000-07-18');
      expect(text).toContain('paul@example.org');
      expect(text).toContain('UV Zwigge 07');
    });

    it('markiert die abweichende Vereinszeile', () => {
      const markiert = render(
        zeile({ csv_club_match: null })
      ).debugElement.queryAll(By.css('tr.bg-amber-50'));

      expect(markiert.length).toBe(1);
      expect(markiert[0].nativeElement.textContent).toContain(
        'Unihockeyverein Zwigge 07 e.V.'
      );
    });

    it('markiert nichts, wenn alle Merkmale stimmen', () => {
      const fixture = render(zeile({ csv_club_match: ZWIGGE }));

      expect(
        fixture.debugElement.queryAll(By.css('tr.bg-amber-50')).length
      ).toBe(0);
    });
  });
});
