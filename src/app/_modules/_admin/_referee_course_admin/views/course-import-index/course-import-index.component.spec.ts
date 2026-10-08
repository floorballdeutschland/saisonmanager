import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseImportService,
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

  function render(imports: RefereeCourseImport[]) {
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
});
