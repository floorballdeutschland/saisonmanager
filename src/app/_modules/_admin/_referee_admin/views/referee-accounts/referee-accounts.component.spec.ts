import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
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
    },
  ],
  failed: [],
  remaining: 5,
  batch_size: 100,
};

describe('RefereeAccountsComponent', () => {
  let fixture: ComponentFixture<RefereeAccountsComponent>;
  let component: RefereeAccountsComponent;
  let refereeService: {
    adminGetMissingUserCount: jasmine.Spy;
    adminImportEmails: jasmine.Spy;
    adminCreateMissingUsers: jasmine.Spy;
  };
  let notify: { success: jasmine.Spy; error: jasmine.Spy };

  const csvFile = (name = 'mails.csv', size = 20): File =>
    ({ name, size }) as File;

  const fileEvent = (file: File | undefined): Event =>
    ({ target: { files: file ? [file] : [], value: 'x' } }) as unknown as Event;

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
});
