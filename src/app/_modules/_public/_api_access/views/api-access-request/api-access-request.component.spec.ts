import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ApiKeyApplicationService } from '@floorball/core';

import { ApiAccessRequestComponent } from './api-access-request.component';

describe('ApiAccessRequestComponent', () => {
  let component: ApiAccessRequestComponent;
  let fixture: ComponentFixture<ApiAccessRequestComponent>;
  let service: jasmine.SpyObj<ApiKeyApplicationService>;

  function setup() {
    service = jasmine.createSpyObj('ApiKeyApplicationService', [
      'getTermsVersion',
      'submit',
    ]);
    service.getTermsVersion.and.returnValue(of({ version: '2026-08-05' }));

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [ApiAccessRequestComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: ApiKeyApplicationService, useValue: service }],
    });

    fixture = TestBed.createComponent(ApiAccessRequestComponent);
    component = fixture.componentInstance;
  }

  function fillForm(): void {
    component.organisation = 'Floorball Beispielstadt';
    component.contactName = 'Test Person';
    component.email = 'antrag@example.com';
    component.projectDescription = 'Widget für die Vereinswebsite.';
    component.purpose = 'Einbindung auf der eigenen Website.';
    component.acceptTerms = true;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('zeigt vor der Auswahl kein Formular', () => {
    setup();
    component.ngOnInit();

    expect(component.showForm).toBeFalse();
    expect(component.isCommercial).toBeFalse();
  });

  it('führt kommerzielle Vorhaben aus dem Antragsweg heraus', () => {
    setup();
    component.ngOnInit();
    fillForm();

    component.chooseIntent('commercial');

    expect(component.isCommercial).toBeTrue();
    expect(component.showForm).toBeFalse();

    component.submit();

    expect(service.submit).not.toHaveBeenCalled();
  });

  it('öffnet das Formular für nicht-kommerzielle Vorhaben', () => {
    setup();
    component.ngOnInit();

    component.chooseIntent('non_commercial');

    expect(component.showForm).toBeTrue();
  });

  it('sperrt das Absenden ohne Pflichtfelder oder Zustimmung', () => {
    setup();
    component.ngOnInit();
    component.chooseIntent('non_commercial');

    expect(component.canSubmit()).toBeFalse();

    fillForm();
    expect(component.canSubmit()).toBeTrue();

    component.acceptTerms = false;
    expect(component.canSubmit()).toBeFalse();

    component.acceptTerms = true;
    component.purpose = '   ';
    expect(component.canSubmit()).toBeFalse();
  });

  it('schickt die Fassung des Servers und commercial=false mit', () => {
    setup();
    service.submit.and.returnValue(of({ success: true }));
    component.ngOnInit();
    component.chooseIntent('non_commercial');
    fillForm();

    component.submit();

    expect(service.submit).toHaveBeenCalledWith({
      accept_terms: true,
      commercial: false,
      organisation: 'Floorball Beispielstadt',
      contact_name: 'Test Person',
      email: 'antrag@example.com',
      address: '',
      project_description: 'Widget für die Vereinswebsite.',
      purpose: 'Einbindung auf der eigenen Website.',
      project_url: '',
      terms_version: '2026-08-05',
    });
    expect(component.done).toBeTrue();
  });

  it('sperrt das Absenden, solange die Fassung nicht abrufbar ist', () => {
    setup();
    service.getTermsVersion.and.returnValue(
      throwError(() => ({ status: 500 }))
    );
    component.ngOnInit();
    component.chooseIntent('non_commercial');
    fillForm();

    expect(component.termsVersion).toBeNull();
    expect(component.canSubmit()).toBeFalse();

    component.submit();
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('zeigt die Meldung des Servers bei einer Ablehnung', () => {
    setup();
    service.submit.and.returnValue(
      throwError(() => ({
        error: { errors: ['Für diese Adresse liegt bereits ein Antrag vor.'] },
      }))
    );
    component.ngOnInit();
    component.chooseIntent('non_commercial');
    fillForm();

    component.submit();

    expect(component.errorMessage).toBe(
      'Für diese Adresse liegt bereits ein Antrag vor.'
    );
    expect(component.done).toBeFalse();
    expect(component.submitting).toBeFalse();
  });
});
