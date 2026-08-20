import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';
import { UikitCommonModule } from '@floorball/uikit/common';
import { NotificationService, RefereeService } from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import {
  RefereeBulkUserResult,
  RefereeEmailImportReport,
} from '@floorball/types';

import { RefereeAccountsComponent } from './referee-accounts.component';

const EMPTY_REPORT: RefereeEmailImportReport = {
  total_rows: 0,
  updated: [],
  skipped: [],
  not_found: [],
  invalid: [],
};

const BULK_RESULT: RefereeBulkUserResult = {
  requested: 2,
  created: [
    {
      id: 1,
      lizenznummer: 4711,
      name: 'Ida Muster',
      email: 'ida@example.org',
      user_name: 'sr-4711',
      duplicate_email: false,
      email_sent: true,
    },
  ],
  failed: [],
  remaining: 5,
  batch_size: 100,
};

const ACCOUNTS_I18N = {
  de: {
    refereeAdmin: {
      accounts: {
        title: 'Schiedsrichter-Benutzerkonten',
        missingCount: '{{ count }} offen',
        createButton: '{{ count }} Konten anlegen',
        creating: 'Lege an…',
        countError: 'Die Anzahl konnte nicht geladen werden.',
        retry: 'Erneut versuchen',
        reportSkipped: 'Übersprungen ({{ count }})',
        reasonIdentical: 'identisch',
        reasonOtherEmail: 'andere Adresse',
        createdList: 'Angelegt ({{ count }})',
        mailFailed: 'Mail nicht verschickt',
        mailFailedTitle: 'Konto da, Mail nicht raus',
        duplicateEmail: 'Adresse doppelt',
      },
    },
  },
};

const skip = (row: number, reason: 'identical' | 'other_email') => ({
  row,
  id: 7,
  lizenznummer: 4711,
  name: 'Ida Muster',
  email: 'profil@example.org',
  csv_email: 'csv@example.org',
  reason,
});

// Fuer validateFile genuegen Name und Groesse; ueber die Leitung geht in diesen
// Specs nichts (der Service ist gestubbt).
const csvFile = (name = 'mails.csv', size = 20): File =>
  ({ name, size }) as File;

const fileEvent = (file: File | undefined): Event =>
  ({ target: { files: file ? [file] : [], value: 'x' } }) as unknown as Event;

describe('RefereeAccountsComponent', () => {
  let fixture: ComponentFixture<RefereeAccountsComponent>;
  let component: RefereeAccountsComponent;
  let refereeService: {
    adminGetMissingUserCount: jasmine.Spy;
    adminImportEmails: jasmine.Spy;
    adminCreateMissingUsers: jasmine.Spy;
  };
  let notify: { success: jasmine.Spy; error: jasmine.Spy };

  async function setUp(count = 7) {
    refereeService = {
      adminGetMissingUserCount: jasmine
        .createSpy('adminGetMissingUserCount')
        .and.returnValue(of({ count, batch_size: 100 })),
      adminImportEmails: jasmine
        .createSpy('adminImportEmails')
        .and.returnValue(of(EMPTY_REPORT)),
      adminCreateMissingUsers: jasmine
        .createSpy('adminCreateMissingUsers')
        .and.returnValue(of(BULK_RESULT)),
    };
    notify = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
    };

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, getTranslocoTestingModule()],
      declarations: [RefereeAccountsComponent],
      providers: [
        { provide: RefereeService, useValue: refereeService },
        { provide: NotificationService, useValue: notify },
      ],
    })
      .overrideTemplate(RefereeAccountsComponent, '')
      .compileComponents();

    fixture = TestBed.createComponent(RefereeAccountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('laedt die offene Anzahl beim Oeffnen', async () => {
    await setUp(7);

    expect(refereeService.adminGetMissingUserCount).toHaveBeenCalled();
    expect(component.missing?.count).toBe(7);
  });

  // Der Knopf legt nie mehr als eine Tranche an. Ohne diese Begrenzung stuende
  // bei 800 offenen Konten ein Knopf, der aussieht, als legte er alle an.
  it('nennt als naechste Tranche das Minimum aus Rest und Tranchengroesse', async () => {
    await setUp(250);
    expect(component.nextBatchSize()).toBe(100);

    component.missing = { count: 12, batch_size: 100 };
    expect(component.nextBatchSize()).toBe(12);
  });

  it('nennt ohne geladene Zahl keine Tranche', async () => {
    await setUp();
    component.missing = null;

    expect(component.nextBatchSize()).toBe(0);
  });

  it('weist eine Datei ohne CSV-Endung ab, ohne sie zu senden', async () => {
    await setUp();

    component.onFileSelected(fileEvent(csvFile('mails.xlsx')));

    expect(refereeService.adminImportEmails).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('weist eine leere Datei ab', async () => {
    await setUp();

    component.onFileSelected(fileEvent(csvFile('mails.csv', 0)));

    expect(refereeService.adminImportEmails).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('weist eine zu grosse Datei ab', async () => {
    await setUp();

    component.onFileSelected(
      fileEvent(csvFile('mails.csv', 5 * 1024 * 1024 + 1))
    );

    expect(refereeService.adminImportEmails).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  // Neu eingetragene Adressen sind neue Kandidaten fuer die Massenanlage; ohne
  // das Nachladen stuende dort weiter die alte Zahl.
  it('laedt die Anzahl nach einem Import neu', async () => {
    await setUp();
    refereeService.adminGetMissingUserCount.calls.reset();

    component.onFileSelected(fileEvent(csvFile()));

    expect(refereeService.adminImportEmails).toHaveBeenCalled();
    expect(component.report).toEqual(EMPTY_REPORT);
    expect(refereeService.adminGetMissingUserCount).toHaveBeenCalled();
  });

  it('meldet den Fehler des Servers beim Import', async () => {
    await setUp();
    refereeService.adminImportEmails.and.returnValue(
      throwError(() => ({ error: { error: 'CSV fehlt Pflichtspalten' } }))
    );

    component.onFileSelected(fileEvent(csvFile()));

    expect(notify.error).toHaveBeenCalledWith('CSV fehlt Pflichtspalten');
    expect(component.importing).toBeFalse();
    expect(component.report).toBeNull();
  });

  it('uebernimmt das Ergebnis der Massenanlage und laedt die Anzahl neu', async () => {
    await setUp();
    refereeService.adminGetMissingUserCount.calls.reset();

    component.createMissingUsers();

    expect(component.bulkResult?.created.length).toBe(1);
    expect(component.bulkResult?.remaining).toBe(5);
    expect(component.creating).toBeFalse();
    expect(refereeService.adminGetMissingUserCount).toHaveBeenCalled();
  });

  it('meldet den Fehler der Massenanlage', async () => {
    await setUp();
    refereeService.adminCreateMissingUsers.and.returnValue(
      throwError(() => ({ error: { error: 'Nicht berechtigt' } }))
    );

    component.createMissingUsers();

    expect(notify.error).toHaveBeenCalledWith('Nicht berechtigt');
    expect(component.creating).toBeFalse();
    expect(component.bulkResult).toBeNull();
  });

  // Ein zweiter Klick waehrend des Laufs waere eine zweite Tranche, also bis zu
  // 100 weitere Konten und Mails. Das [disabled] im Template allein genuegt
  // nicht, wenn die Methode von woanders erreicht wird.
  it('startet keine zweite Tranche, solange die erste laeuft', async () => {
    await setUp();
    refereeService.adminCreateMissingUsers.and.returnValue(
      new Observable<RefereeBulkUserResult>()
    );

    component.createMissingUsers();
    component.createMissingUsers();

    expect(refereeService.adminCreateMissingUsers).toHaveBeenCalledTimes(1);
  });

  it('laedt keine zweite Datei, solange der Import laeuft', async () => {
    await setUp();
    refereeService.adminImportEmails.and.returnValue(
      new Observable<RefereeEmailImportReport>()
    );

    component.onFileSelected(fileEvent(csvFile()));
    component.onFileSelected(fileEvent(csvFile()));

    expect(refereeService.adminImportEmails).toHaveBeenCalledTimes(1);
  });

  // „0 Adressen eingetragen" ist kein Erfolg, und eine gruene Meldung ueber einem
  // Report voller unbrauchbarer Zeilen liest sich als „hat geklappt".
  it('meldet einen Import ohne Treffer nicht als Erfolg', async () => {
    await setUp();

    component.onFileSelected(fileEvent(csvFile()));

    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('meldet eine Massenanlage mit Fehlschlaegen nicht als Erfolg', async () => {
    await setUp();
    refereeService.adminCreateMissingUsers.and.returnValue(
      of({
        ...BULK_RESULT,
        failed: [
          { id: 2, lizenznummer: 4712, name: 'Udo Test', error: 'Name belegt' },
        ],
      })
    );

    component.createMissingUsers();

    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('merkt sich einen Fehlschlag beim Zaehlen fuer die Anzeige', async () => {
    await setUp();
    refereeService.adminGetMissingUserCount.and.returnValue(
      throwError(() => ({ status: 500 }))
    );

    component.loadCount();

    expect(component.countFailed).toBeTrue();
    expect(component.missing).toBeNull();
  });
});

// Die Vorlage selbst, nicht nur die Logik: Der Doppelklick-Schutz und die
// Fehlerzustaende haengen an Bindungen, die ein overrideTemplate wegwirft.
describe('RefereeAccountsComponent (Vorlage)', () => {
  let fixture: ComponentFixture<RefereeAccountsComponent>;
  let component: RefereeAccountsComponent;

  const text = (): string => fixture.nativeElement.textContent;
  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button'));
  const buttonWith = (label: string): HTMLButtonElement | undefined =>
    buttons().find((b) => b.textContent!.includes(label));

  // Die Komponente ist OnPush und ihre Zustandswechsel kommen hier nicht aus
  // einem DOM-Event. Ohne markForCheck an ihrem EIGENEN ChangeDetectorRef
  // (fixture.changeDetectorRef ist die Wrapper-View) rendert detectChanges den
  // alten Stand, ohne zu meckern.
  const refresh = (): void => {
    fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  };

  async function render(count: number, service: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [
        UikitCommonModule,
        RouterTestingModule,
        getTranslocoTestingModule(ACCOUNTS_I18N),
      ],
      declarations: [RefereeAccountsComponent],
      providers: [
        {
          provide: RefereeService,
          useValue: {
            adminGetMissingUserCount: () => of({ count, batch_size: 100 }),
            adminImportEmails: () => of(EMPTY_REPORT),
            adminCreateMissingUsers: () => of(BULK_RESULT),
            ...service,
          },
        },
        {
          provide: NotificationService,
          useValue: { success: () => undefined, error: () => undefined },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeAccountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('sperrt den Knopf, solange angelegt wird', async () => {
    // Nie abschliessendes Observable: der Lauf bleibt in flight.
    await render(7, {
      adminCreateMissingUsers: () => new Observable<RefereeBulkUserResult>(),
    });
    expect(buttonWith('Konten anlegen')!.disabled).toBeFalse();

    component.createMissingUsers();
    refresh();

    expect(buttonWith('Lege an')!.disabled).toBeTrue();
  });

  it('zeigt keinen Knopf, wenn nichts offen ist', async () => {
    await render(0);

    expect(buttonWith('Konten anlegen')).toBeUndefined();
  });

  it('bietet nach einem Fehlschlag beim Zaehlen ein Wiederholen an', async () => {
    await render(7, {
      adminGetMissingUserCount: () => throwError(() => ({ status: 500 })),
    });

    expect(buttonWith('Erneut versuchen')).toBeDefined();
    expect(text()).toContain('Die Anzahl konnte nicht geladen werden.');
  });

  // Dieselbe Lizenznummer darf mehrfach in der Datei stehen; ueber die Schiri-ID
  // getrackt waeren das doppelte Schluessel.
  it('rendert zwei uebersprungene Zeilen zur selben Lizenznummer', async () => {
    await render(7, {
      adminImportEmails: () =>
        of({
          ...EMPTY_REPORT,
          total_rows: 2,
          skipped: [skip(2, 'other_email'), skip(3, 'identical')],
        }),
    });

    component.onFileSelected(fileEvent(csvFile()));
    refresh();

    expect(text()).toContain('Übersprungen (2)');
    expect(text()).toContain('andere Adresse');
    expect(text()).toContain('identisch');
  });

  it('markiert ein Konto, dessen Willkommensmail nicht rausging', async () => {
    await render(7, {
      adminCreateMissingUsers: () =>
        of({
          ...BULK_RESULT,
          created: [{ ...BULK_RESULT.created[0], email_sent: false }],
        }),
    });

    component.createMissingUsers();
    refresh();

    expect(text()).toContain('Mail nicht verschickt');
  });
});
