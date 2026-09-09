import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, Subject } from 'rxjs';
import {
  ClubService,
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseImportService,
  RefereeService,
} from '@floorball/core';
import {
  Club,
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

// Der Stand in der Datenbank. Ohne ihn zeigt die Maske keinen Konflikt, denn
// „Abweichung" heisst: Datei und Datenbank tragen beide etwas, und es ist
// verschieden.
const ZWIGGE = { id: 143, name: 'UV Zwigge 07', state_association_id: 3 };

const SCHIRI = {
  id: 500,
  lizenznummer: 7940,
  vorname: 'Paul',
  nachname: 'Morgenroth',
  geburtsdatum: '2000-07-18',
  email: 'paul@example.org',
  club_id: 143,
};

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
  let notify: jasmine.SpyObj<NotificationService>;
  let clubService: jasmine.SpyObj<ClubService>;

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
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    clubService = jasmine.createSpyObj('ClubService', ['getAdminClubAll']);
    clubService.getAdminClubAll.and.returnValue(of([ZWIGGE as Club]));

    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        UikitCommonModule,
        // Der „zurück"-Link im Kopf der Maske: ohne die Direktive protokolliert
        // jeder Render-Test NG0303.
        RouterLink,
        // Echte Texte für die Konflikt-Knöpfe: Der geprüfte Wert steckt in
        // einem Übersetzungsparameter, ohne hinterlegten Schlüssel rendert
        // Transloco nur den Schlüssel und der Wert taucht nirgends auf.
        getTranslocoTestingModule({
          de: {
            refereeCourseAdmin: {
              detail: {
                conflictLabel: 'Abweichung „{{ field }}":',
                csvOption: 'CSV: {{ value }}',
                dbOption: 'DB: {{ value }}',
              },
            },
          },
        }),
      ],
      declarations: [CourseImportDetailComponent],
      providers: [
        { provide: RefereeCourseImportService, useValue: importService },
        { provide: RefereeService, useValue: refereeService },
        { provide: ClubService, useValue: clubService },
        { provide: NotificationService, useValue: notify },
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

  // Die Fälle, die die Maske tatsächlich rendern — die Getter darüber prüfen
  // die Logik, hier geht es um die Riegel im Template. Ein 403 der API führt
  // über den ErrorInterceptor auf die Startseite; ein Knopf, der einen
  // auslösen kann, ist deshalb kein kosmetisches Problem.
  describe('Riegel in der Maske', () => {
    function render(data: RefereeCourseImportWithResults) {
      const fixture = TestBed.createComponent(CourseImportDetailComponent);
      fixture.componentInstance.licenseLevels = [STUFE_G];
      importService.getImport.and.returnValue(of(data));
      fixture.detectChanges();
      return fixture;
    }

    it('zeigt die Konflikt-Knöpfe einer eingereichten Zeile nicht', () => {
      const fixture = render(
        importMit(
          [
            zeile({
              id: 1,
              match_type: 'partial_match',
              match_field_count: 5,
              submitted_at: '2026-09-08T11:00:00Z',
              csv: { ...zeile().csv, nachname: 'Abweichler' },
              referee_snapshot: SCHIRI,
            }),
          ],
          { status: 'partially_submitted' }
        )
      );

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).not.toContain('Abweichler');
    });

    it('zeigt die Konflikt-Knöpfe einer offenen Zeile', () => {
      const fixture = render(
        importMit([
          zeile({
            id: 1,
            match_type: 'partial_match',
            match_field_count: 5,
            csv: { ...zeile().csv, nachname: 'Abweichler' },
            referee_snapshot: SCHIRI,
          }),
        ])
      );

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Abweichler');
    });

    // `await whenStable()`: Das Lizenzstufen-Feld haengt an `ngModel`, und das
    // traegt sowohl den Wert als auch den gesperrten Zustand erst im
    // Microtask nach dem Zeichnen ein.
    it('sperrt das Lizenzstufen-Feld einer verworfenen Zeile', async () => {
      const fixture = render(importMit([zeile({ id: 1, status: 'rejected' })]));
      await fixture.whenStable();

      const select: HTMLSelectElement =
        fixture.nativeElement.querySelector('select');
      expect(select.disabled).toBeTrue();
    });

    it('zeigt das Vereinsfeld nur auf einer offenen Zeile', () => {
      const offen = render(importMit([zeile({ id: 1 })]));
      expect(
        offen.nativeElement.querySelector('fb-select-search')
      ).toBeTruthy();

      const eingereicht = render(
        importMit([zeile({ id: 2, submitted_at: '2026-09-08T11:00:00Z' })], {
          status: 'partially_submitted',
        })
      );
      expect(
        eingereicht.nativeElement.querySelector('fb-select-search')
      ).toBeNull();
    });

    it('lässt das Lizenzstufen-Feld einer offenen Zeile bedienbar', async () => {
      const fixture = render(importMit([zeile({ id: 1 })]));
      await fixture.whenStable();

      const select: HTMLSelectElement =
        fixture.nativeElement.querySelector('select');
      expect(select.disabled).toBeFalse();
    });
  });

  // Die gespeicherte Lizenzstufe muss im Auswahlfeld auch stehen. Mit einem
  // reinen Wertbinding tat sie das nicht: Der Wert wird gesetzt, bevor die
  // Optionen existieren, der Browser verwirft ihn, und nachgeschrieben wird
  // er nie. Sichtbar wurde das nach jedem Neuzeichnen der Tabelle — sämtliche
  // Stufen standen wieder auf „bitte wählen", obwohl sie gespeichert waren.
  describe('Anzeige der gespeicherten Lizenzstufe', () => {
    function render(data: RefereeCourseImportWithResults) {
      const fixture = TestBed.createComponent(CourseImportDetailComponent);
      importService.getImport.and.returnValue(of(data));
      fixture.detectChanges();
      return fixture;
    }

    it('zeigt sie beim ersten Zeichnen', async () => {
      const fixture = render(importMit([zeile({ id: 1, lizenzstufe: 'G' })]));
      await fixture.whenStable();

      const select: HTMLSelectElement =
        fixture.nativeElement.querySelector('select');
      expect(select.value).toBe('G');
    });

    it('zeigt sie nach einem Neuladen der Tabelle weiter', async () => {
      const fixture = render(importMit([zeile({ id: 1, lizenzstufe: 'G' })]));
      await fixture.whenStable();

      // Neuladen passiert im Betrieb nach dem Verwerfen einer Zeile, nach dem
      // Einreichen und im Fehlerfall eines Zeilen-PATCH.
      fixture.componentInstance.load(9);
      fixture.detectChanges();
      await fixture.whenStable();

      const select: HTMLSelectElement =
        fixture.nativeElement.querySelector('select');
      expect(select.value).toBe('G');
    });

    // Der zweite Weg in denselben Fehler: Die Stufenliste kommt aus einer
    // eigenen Anfrage und kann NACH den Importdaten eintreffen. Dann existiert
    // beim Setzen des Werts nicht einmal die Option, auf die er zeigt.
    it('zeigt sie auch, wenn die Stufenliste erst danach eintrifft', async () => {
      const stufen$ = new Subject<RefereeLicenseLevel[]>();
      refereeService.adminGetLicenseLevels.and.returnValue(stufen$);
      const fixture = render(importMit([zeile({ id: 1, lizenzstufe: 'G' })]));
      await fixture.whenStable();

      stufen$.next([STUFE_G]);
      fixture.detectChanges();
      await fixture.whenStable();

      const select: HTMLSelectElement =
        fixture.nativeElement.querySelector('select');
      expect(select.value).toBe('G');
    });

    it('zeigt den Platzhalter, solange keine Stufe gesetzt ist', async () => {
      const fixture = render(importMit([zeile({ id: 1, lizenzstufe: null })]));
      await fixture.whenStable();

      const select: HTMLSelectElement =
        fixture.nativeElement.querySelector('select');
      expect(select.value).toBe('');
    });
  });

  // Ein nicht zugeordneter Vereinsname ist meist ein Tippfehler oder eine
  // Schreibweise, die die Datenbank anders führt. Die Korrektur lief bisher
  // nur über die Freigabe des Landesverbands oder über eine neue Datei.
  describe('Verein der Zeile', () => {
    it('schickt den gewählten Verein als Änderung der Zeile', () => {
      // Die Lage, um die es geht: Der Name aus der Datei traf nichts, die
      // Zeile trägt keinen Verein.
      const r = zeile({
        id: 7,
        csv_club_match: null,
        master_by_importer: { ...zeile().master_by_importer, club_id: null },
      });
      component.importData = importMit([r]);
      importService.updateResult.and.returnValue(of(r));

      component.setClub(r, 143);

      expect(importService.updateResult).toHaveBeenCalledWith(7, {
        master_by_importer: { club_id: 143 },
      });
    });

    it('schickt nichts, wenn sich der Verein nicht ändert', () => {
      const r = zeile({
        id: 7,
        master_by_importer: { ...zeile().master_by_importer, club_id: 143 },
      });
      component.importData = importMit([r]);

      component.setClub(r, 143);

      expect(importService.updateResult).not.toHaveBeenCalled();
    });

    it('meldet einen Namen ohne Treffer, auch wenn ein Zielverein steht', () => {
      // Genau die Lage, die vorher wie ein Treffer aussah: Der Zielwert fällt
      // beim Import auf den Verein des Schiedsrichters zurück.
      const r = zeile({
        id: 1,
        matched_club: ZWIGGE,
        csv_club_match: null,
      });

      expect(component.clubUnmatched(r)).toBeTrue();
    });

    // `matched_club` ist der beim Import gespeicherte Zielwert,
    // `csv_club_match` wird pro Anfrage neu aufgelöst. Für einen alten,
    // noch offenen Import fällt das auseinander — dann erklärt der Hinweis
    // den angezeigten Verein nicht.
    it('verschweigt die Herkunft, wenn sie den angezeigten Verein nicht erklärt', () => {
      const r = zeile({
        id: 1,
        matched_club: null,
        csv_club_match: { ...ZWIGGE, match_type: 'long_name' },
      });

      expect(component.clubMatchHint(r)).toBeNull();
    });

    it('nennt die Herkunft zum angezeigten Verein', () => {
      const r = zeile({
        id: 1,
        matched_club: ZWIGGE,
        csv_club_match: { ...ZWIGGE, match_type: 'long_name' },
      });

      expect(component.clubMatchHint(r)).not.toBeNull();
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

    // Der zweite Klick, während der erste noch läuft: Vorher stieg `discard`
    // still aus, der Dialog schloss sich, und es sah wie ein erfolgtes
    // Verwerfen aus.
    it('meldet einen Klick auf eine Zeile mit laufender Änderung', () => {
      const r = zeile({ id: 5, deferred: true });
      component.importData = importMit([r]);
      component.saving.add(5);

      component.discard(r);

      expect(importService.discardResult).not.toHaveBeenCalled();
      expect(notify.error).toHaveBeenCalled();
    });

    it('reicht nicht ein, während für eine Zeile ein PATCH läuft', () => {
      component.importData = importMit([zeile({ id: 1 })]);
      component.saving.add(1);

      expect(component.canSubmit()).toBeFalse();
      component.submit();
      expect(importService.submitImport).not.toHaveBeenCalled();
    });

    it('erkennt eine vom Landesverband zurückgewiesene Zeile', () => {
      expect(
        component.isRejectedByLv(
          zeile({ status: 'rejected', submitted_at: '2026-09-08T11:00:00Z' })
        )
      ).toBeTrue();
      // Vom Importeur verworfen: nie eingereicht.
      expect(
        component.isRejectedByLv(zeile({ status: 'rejected' }))
      ).toBeFalse();
    });

    it('zählt für den Knopf nur die Zeilen, die noch zur Debatte stehen', () => {
      component.importData = importMit(
        [
          zeile({ id: 1, submitted_at: '2026-09-08T11:00:00Z' }),
          zeile({ id: 2, status: 'rejected' }),
          zeile({ id: 3, deferred: true }),
          zeile({ id: 4 }),
        ],
        { status: 'partially_submitted' }
      );

      expect(component.submittableCount()).toBe(1);
      expect(component.pendingCount()).toBe(2);
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
