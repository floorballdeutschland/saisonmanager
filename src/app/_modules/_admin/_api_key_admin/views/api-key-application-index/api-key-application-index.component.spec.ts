import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ApiKeyApplicationService, NotificationService } from '@floorball/core';
import { ApiKeyApplication } from '@floorball/types';

import { ApiKeyApplicationIndexComponent } from './api-key-application-index.component';

describe('ApiKeyApplicationIndexComponent', () => {
  let component: ApiKeyApplicationIndexComponent;
  let fixture: ComponentFixture<ApiKeyApplicationIndexComponent>;
  let service: jasmine.SpyObj<ApiKeyApplicationService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  const application = (
    overrides: Partial<ApiKeyApplication> = {}
  ): ApiKeyApplication => ({
    id: 1,
    organisation: 'Floorball Beispielstadt',
    contact_name: 'Test Person',
    email: 'antrag@example.com',
    address: null,
    project_description: 'Widget',
    purpose: 'Vereinswebsite',
    project_url: null,
    commercial: false,
    status: 'pending',
    terms_version: '2026-08-05',
    accepted_terms_at: '2026-08-05T10:00:00Z',
    decision_note: null,
    decided_at: null,
    api_key_id: null,
    reveal_state: null,
    reveal_token_expires_at: null,
    key_revealed_at: null,
    created_at: '2026-08-05T10:00:00Z',
    ...overrides,
  });

  function setup() {
    service = jasmine.createSpyObj('ApiKeyApplicationService', [
      'getAll',
      'approve',
      'reject',
      'resendReveal',
    ]);
    notifications = jasmine.createSpyObj('NotificationService', [
      'success',
      'error',
    ]);
    service.getAll.and.returnValue(of([application()]));

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [ApiKeyApplicationIndexComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ApiKeyApplicationService, useValue: service },
        { provide: NotificationService, useValue: notifications },
      ],
    });

    fixture = TestBed.createComponent(ApiKeyApplicationIndexComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lädt beim Start die offenen Anträge', () => {
    setup();

    component.ngOnInit();

    expect(service.getAll).toHaveBeenCalledWith('pending');
    expect(component.applications.length).toBe(1);
    expect(component.pendingCount).toBe(1);
  });

  it('lädt bei „Alle" ohne Statusfilter', () => {
    setup();
    component.ngOnInit();

    component.setStatusFilter('');

    expect(service.getAll).toHaveBeenCalledWith(undefined);
  });

  it('meldet einen Ladefehler', () => {
    setup();
    service.getAll.and.returnValue(throwError(() => ({ status: 500 })));

    component.ngOnInit();

    expect(notifications.error).toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });

  it('genehmigt einen Antrag und lädt neu', () => {
    setup();
    service.approve.and.returnValue(of(application({ status: 'approved' })));
    component.ngOnInit();

    component.approve(component.applications[0]);

    expect(service.approve).toHaveBeenCalledWith(1);
    expect(notifications.success).toHaveBeenCalled();
    expect(service.getAll).toHaveBeenCalledTimes(2);
  });

  it('lehnt nicht ohne Begründung ab', () => {
    setup();
    component.ngOnInit();
    const entry = component.applications[0];

    component.startReject(entry);
    component.rejectionReason = '   ';
    component.confirmReject(entry);

    expect(service.reject).not.toHaveBeenCalled();
  });

  it('schickt die Begründung getrimmt mit', () => {
    setup();
    service.reject.and.returnValue(of(application({ status: 'rejected' })));
    component.ngOnInit();
    const entry = component.applications[0];

    component.startReject(entry);
    component.rejectionReason = '  Kommerzielles Vorhaben  ';
    component.confirmReject(entry);

    expect(service.reject).toHaveBeenCalledWith(1, 'Kommerzielles Vorhaben');
    expect(component.rejectingId).toBeNull();
  });

  it('stellt einen neuen Abhol-Link nur vor der Abholung aus', () => {
    setup();

    expect(component.canResendReveal(application())).toBeFalse();
    expect(
      component.canResendReveal(application({ status: 'approved' }))
    ).toBeTrue();
    expect(
      component.canResendReveal(
        application({
          status: 'approved',
          key_revealed_at: '2026-08-06T10:00:00Z',
        })
      )
    ).toBeFalse();
  });

  it('blockt einen zweiten Klick, solange die Entscheidung läuft', () => {
    setup();
    // Kein Rückgabewert: Der Aufruf bleibt offen, busyIds bleibt gesetzt.
    service.approve.and.returnValue(of());
    component.ngOnInit();
    const entry = component.applications[0];

    component.approve(entry);
    component.approve(entry);

    expect(service.approve).toHaveBeenCalledTimes(1);
  });
});
