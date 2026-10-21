import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseImportService,
  SessionService,
} from '@floorball/core';
import { RefereeCourseImport } from '@floorball/types';
import { CourseImportIndexComponent } from './course-import-index.component';

// Abgeschlossene Importe verschwinden standardmäßig aus der Liste. Ein
// eingereichter Import mit Zeilen, die noch auf den Landesverband warten, ist
// nicht abgeschlossen und muss sichtbar bleiben.

function imp(id: number, status: string, pending = 0): RefereeCourseImport {
  return {
    id,
    filename: `kurs-${id}.csv`,
    status,
    total_rows: 3,
    uploaded_by_user_id: 1,
    created_at: '2026-09-08T10:00:00Z',
    progress: { pending_review: pending },
  } as unknown as RefereeCourseImport;
}

describe('CourseImportIndexComponent', () => {
  const IMPORTE = [
    imp(1, 'in_review', 3),
    imp(2, 'partially_submitted', 1),
    imp(3, 'submitted', 0),
    imp(4, 'submitted', 2),
    imp(5, 'cancelled'),
  ];

  function render(
    imports: RefereeCourseImport[],
    permissions: Record<string, boolean> = {
      referee_course_import_upload: true,
    }
  ) {
    const service = jasmine.createSpyObj('RefereeCourseImportService', [
      'listImports',
    ]);
    service.listImports.and.returnValue(of(imports));
    TestBed.configureTestingModule({
      imports: [RouterLink, getTranslocoTestingModule()],
      declarations: [CourseImportIndexComponent],
      providers: [
        { provide: RefereeCourseImportService, useValue: service },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', ['error']),
        },
        {
          provide: SessionService,
          useValue: { currentUserValue: { permissions } },
        },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(CourseImportIndexComponent);
    fixture.detectChanges();
    return fixture;
  }

  function dateinamen(el: HTMLElement): string[] {
    return Array.from(el.querySelectorAll('tbody tr td:first-child')).map(
      (td) => td.textContent?.trim() ?? ''
    );
  }

  it('blendet abgeschlossene Importe aus, eingereichte mit offenen Reviews nicht', () => {
    const fixture = render(IMPORTE);

    expect(dateinamen(fixture.nativeElement)).toEqual([
      'kurs-1.csv',
      'kurs-2.csv',
      'kurs-4.csv',
    ]);
    expect(fixture.componentInstance.closedCount()).toBe(2);
  });

  it('zeigt abgeschlossene Importe über das Häkchen wieder an', () => {
    const fixture = render(IMPORTE);
    const box: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type="checkbox"]'
    );

    box.click();
    fixture.detectChanges();

    expect(dateinamen(fixture.nativeElement).length).toBe(5);
  });

  it('zeigt kein Häkchen, solange nichts abgeschlossen ist', () => {
    const fixture = render([imp(1, 'in_review', 3)]);

    expect(
      fixture.nativeElement.querySelector('input[type="checkbox"]')
    ).toBeNull();
  });

  it('sagt, dass alles abgeschlossen ist, statt eine leere Tabelle zu zeigen', () => {
    const fixture = render([imp(3, 'submitted', 0)]);

    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('allClosed');
  });

  // `pending_review` zählt beides: Zeilen beim Importeur und eingereichte beim
  // Landesverband. Die Übersicht trennt die beiden Lagen.
  function zellen(el: HTMLElement, row: number): string[] {
    return Array.from(el.querySelectorAll(`tbody tr:nth-child(${row}) td`)).map(
      (td) => td.textContent?.trim() ?? ''
    );
  }

  it('trennt "zu bearbeiten" von "offen beim LV"', () => {
    const teilweise = imp(2, 'partially_submitted', 5);
    teilweise.progress = {
      total: 9,
      pending_review: 5,
      applied: 4,
      rejected: 0,
      deferred: 1,
      submittable: 1,
    };
    const fixture = render([teilweise]);

    // Datei, Datum, Datensätze, zu bearbeiten, beim LV, Status
    expect(zellen(fixture.nativeElement, 1).slice(3, 5)).toEqual(['2', '3']);
  });

  it('zählt beim abgebrochenen Import nichts als offen', () => {
    const abgebrochen = imp(5, 'cancelled', 3);
    abgebrochen.progress!.submittable = 3;
    const fixture = render([abgebrochen]);

    expect(fixture.componentInstance.toEditCount(abgebrochen)).toBe(0);
    expect(fixture.componentInstance.atLvCount(abgebrochen)).toBe(0);
  });

  // Der CSV-Import laesst sich in den Schiri-Einstellungen abschalten.
  function uploadFeld(el: HTMLElement): HTMLInputElement | null {
    return el.querySelector('input[type="file"]');
  }

  it('zeigt den Upload, solange der Import an ist', () => {
    const fixture = render([imp(1, 'in_review', 3)]);

    expect(uploadFeld(fixture.nativeElement)).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-test="import-disabled"]')
    ).toBeNull();
  });

  it('blendet den Upload bei abgeschaltetem Import aus, offene Importe bleiben', () => {
    const fixture = render([imp(1, 'in_review', 3)], {
      referee_course_import_upload: false,
    });

    expect(uploadFeld(fixture.nativeElement)).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-test="import-disabled"]')
    ).not.toBeNull();
    expect(dateinamen(fixture.nativeElement)).toEqual(['kurs-1.csv']);
  });

  it('laesst den Upload stehen, wenn das Konto das Recht noch nicht kennt', () => {
    // Angemeldet vor Einfuehrung des Rechts: Die API entscheidet.
    const fixture = render([imp(1, 'in_review', 3)], {});

    expect(uploadFeld(fixture.nativeElement)).not.toBeNull();
  });
});
