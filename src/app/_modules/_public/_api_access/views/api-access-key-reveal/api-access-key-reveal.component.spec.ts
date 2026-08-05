import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ApiKeyApplicationService } from '@floorball/core';

import { ApiAccessKeyRevealComponent } from './api-access-key-reveal.component';

describe('ApiAccessKeyRevealComponent', () => {
  let component: ApiAccessKeyRevealComponent;
  let fixture: ComponentFixture<ApiAccessKeyRevealComponent>;
  let service: jasmine.SpyObj<ApiKeyApplicationService>;

  function setup(queryParams: Record<string, string> = { token: 'tok' }) {
    service = jasmine.createSpyObj('ApiKeyApplicationService', [
      'checkRevealToken',
      'revealKey',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [ApiAccessKeyRevealComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ApiKeyApplicationService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(ApiAccessKeyRevealComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('prüft den Link, ohne ihn zu verbrauchen', () => {
    setup();
    service.checkRevealToken.and.returnValue(
      of({
        state: 'valid',
        organisation: 'Floorball Beispielstadt',
        expires_at: '2026-08-20T12:00:00Z',
      })
    );

    component.ngOnInit();

    expect(service.checkRevealToken).toHaveBeenCalledWith('tok');
    expect(service.revealKey).not.toHaveBeenCalled();
    expect(component.state).toBe('valid');
    expect(component.organisation).toBe('Floorball Beispielstadt');
    expect(component.rawKey).toBeNull();
  });

  it('zeigt den Key erst nach dem bewussten Klick', () => {
    setup();
    service.checkRevealToken.and.returnValue(of({ state: 'valid' }));
    service.revealKey.and.returnValue(
      of({ raw_key: 'abc123', name: 'Floorball Beispielstadt (Antrag #1)' })
    );
    component.ngOnInit();

    component.reveal();

    expect(service.revealKey).toHaveBeenCalledWith('tok');
    expect(component.rawKey).toBe('abc123');
    expect(component.keyName).toBe('Floorball Beispielstadt (Antrag #1)');
  });

  it('holt bei einem bereits verbrauchten Link keinen Key', () => {
    setup();
    service.checkRevealToken.and.returnValue(of({ state: 'already_revealed' }));
    component.ngOnInit();

    component.reveal();

    expect(service.revealKey).not.toHaveBeenCalled();
    expect(component.state).toBe('already_revealed');
  });

  it('erkennt einen abgelaufenen Link', () => {
    setup();
    service.checkRevealToken.and.returnValue(of({ state: 'expired' }));

    component.ngOnInit();

    expect(component.state).toBe('expired');
  });

  it('behandelt einen unbekannten Link als ungültig', () => {
    setup();
    service.checkRevealToken.and.returnValue(
      throwError(() => ({ status: 410 }))
    );

    component.ngOnInit();

    expect(component.state).toBe('invalid');
    expect(component.loading).toBeFalse();
  });

  it('ruft ohne Token nichts ab', () => {
    setup({});

    component.ngOnInit();

    expect(service.checkRevealToken).not.toHaveBeenCalled();
    expect(component.state).toBe('invalid');
  });

  it('fällt auf ungültig zurück, wenn das Abholen scheitert', () => {
    setup();
    service.checkRevealToken.and.returnValue(of({ state: 'valid' }));
    service.revealKey.and.returnValue(
      throwError(() => ({ error: { message: 'Dieser Link ist ungültig.' } }))
    );
    component.ngOnInit();

    component.reveal();

    expect(component.rawKey).toBeNull();
    expect(component.state).toBe('invalid');
    expect(component.errorMessage).toBe('Dieser Link ist ungültig.');
  });
});
