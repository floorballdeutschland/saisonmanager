import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { ApiKeyService, NotificationService } from '@floorball/core';
import { ApiKey } from '@floorball/types';

import { ApiKeyIndexComponent } from './api-key-index.component';

describe('ApiKeyIndexComponent', () => {
  let fixture: ComponentFixture<ApiKeyIndexComponent>;
  let service: jasmine.SpyObj<ApiKeyService>;

  const key = (overrides: Partial<ApiKey> = {}): ApiKey => ({
    id: 7,
    name: 'Partner-Key',
    active: true,
    rate_limit: 60,
    realtime: false,
    features: ['detailed_stats'],
    created_at: '2026-10-01T10:00:00Z',
    last_used_at: null,
    usage_30_days: 0,
    application: null,
    ...overrides,
  });

  function setup(keys: ApiKey[]) {
    service = jasmine.createSpyObj('ApiKeyService', ['getAll', 'update']);
    service.getAll.and.returnValue(of(keys));
    service.update.and.returnValue(of(keys[0]));

    TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule()],
      declarations: [ApiKeyIndexComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ApiKeyService, useValue: service },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'error',
            'success',
          ]),
        },
      ],
    });

    fixture = TestBed.createComponent(ApiKeyIndexComponent);
    fixture.detectChanges();
  }

  const checkbox = (feature: string): HTMLInputElement =>
    fixture.nativeElement.querySelector(`[data-test="feature-${feature}-7"]`);

  afterEach(() => TestBed.resetTestingModule());

  it('zeigt je Zusatzpaket ein Häkchen mit dem Stand des Keys', () => {
    setup([key()]);

    expect(checkbox('detailed_stats').checked).toBeTrue();
    expect(checkbox('league_shot_stats').checked).toBeFalse();
  });

  it('schaltet ein Paket zu und wieder ab, ohne die übrigen anzufassen', () => {
    setup([key()]);

    checkbox('league_shot_stats').click();
    expect(service.update).toHaveBeenCalledWith(7, {
      features: ['detailed_stats', 'league_shot_stats'],
    });

    checkbox('detailed_stats').click();
    expect(service.update).toHaveBeenCalledWith(7, { features: [] });
  });

  it('kommt mit einer API ohne features aus', () => {
    setup([key({ features: undefined })]);

    expect(checkbox('detailed_stats').checked).toBeFalse();
    checkbox('detailed_stats').click();
    expect(service.update).toHaveBeenCalledWith(7, {
      features: ['detailed_stats'],
    });
  });
});
