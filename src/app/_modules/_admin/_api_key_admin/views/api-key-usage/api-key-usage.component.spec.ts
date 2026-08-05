import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ApiKeyService, ApiKeyUsageData } from '@floorball/core';

import { ApiKeyUsageComponent } from './api-key-usage.component';

describe('ApiKeyUsageComponent', () => {
  let component: ApiKeyUsageComponent;
  let fixture: ComponentFixture<ApiKeyUsageComponent>;
  let service: jasmine.SpyObj<ApiKeyService>;

  const usage = (
    overrides: Partial<ApiKeyUsageData> = {}
  ): ApiKeyUsageData => ({
    name: 'Partner-Key',
    rate_limit: null,
    last_30_days: [
      { date: '2026-08-04', count: 10 },
      { date: '2026-08-05', count: 40 },
    ],
    last_year: [{ month: '2026-08', count: 50 }],
    by_endpoint: [
      { endpoint: 'teams#stats', count: 20 },
      { endpoint: 'leagues#schedule', count: 30 },
    ],
    ...overrides,
  });

  function setup(params: Record<string, string> = { id: '7' }) {
    service = jasmine.createSpyObj('ApiKeyService', ['getUsage']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [ApiKeyUsageComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ApiKeyService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(params) } },
        },
      ],
    });

    fixture = TestBed.createComponent(ApiKeyUsageComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lädt die Nutzung des Keys aus der Adresse', () => {
    setup();
    service.getUsage.and.returnValue(of(usage()));

    component.ngOnInit();

    expect(service.getUsage).toHaveBeenCalledWith(7);
    expect(component.total30Days).toBe(50);
    expect(component.peakDay).toBe(40);
  });

  it('rechnet die Balkenhöhe am Spitzentag', () => {
    setup();
    service.getUsage.and.returnValue(of(usage()));
    component.ngOnInit();

    expect(component.dailyHeight(40)).toBe(100);
    expect(component.dailyHeight(10)).toBe(25);
  });

  it('teilt nicht durch null, wenn es keine Zugriffe gibt', () => {
    setup();
    service.getUsage.and.returnValue(
      of(usage({ last_30_days: [], last_year: [], by_endpoint: [] }))
    );
    component.ngOnInit();

    expect(component.dailyHeight(0)).toBe(0);
    expect(component.share(0)).toBe(0);
    expect(component.endpoints).toEqual([]);
  });

  it('sortiert die Endpunkte nach Häufigkeit und auf Wunsch nach Name', () => {
    setup();
    service.getUsage.and.returnValue(of(usage()));
    component.ngOnInit();

    expect(component.endpoints.map((e) => e.endpoint)).toEqual([
      'leagues#schedule',
      'teams#stats',
    ]);

    component.setSort('endpoint');
    expect(component.endpoints.map((e) => e.endpoint)).toEqual([
      'leagues#schedule',
      'teams#stats',
    ]);
  });

  it('rechnet den Anteil eines Endpunkts', () => {
    setup();
    service.getUsage.and.returnValue(of(usage()));
    component.ngOnInit();

    expect(component.share(30)).toBe(60);
    expect(component.share(20)).toBe(40);
  });

  it('meldet einen Ladefehler', () => {
    setup();
    service.getUsage.and.returnValue(throwError(() => ({ status: 503 })));

    component.ngOnInit();

    expect(component.loadError).toBe('apiKeys.usage.loadError');
    expect(component.loading).toBeFalse();
  });

  it('ruft ohne Key-Id nichts ab', () => {
    setup({});

    component.ngOnInit();

    expect(service.getUsage).not.toHaveBeenCalled();
    expect(component.loadError).toBeTruthy();
  });
});
