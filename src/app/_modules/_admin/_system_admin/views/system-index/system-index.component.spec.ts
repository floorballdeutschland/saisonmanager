import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import {
  BlockedIp,
  SystemHealthData,
  SystemHealthService,
} from '@floorball/core';

import { SystemIndexComponent } from './system-index.component';

describe('SystemIndexComponent', () => {
  let component: SystemIndexComponent;
  let fixture: ComponentFixture<SystemIndexComponent>;
  let service: jasmine.SpyObj<SystemHealthService>;

  const health = (
    overrides: Partial<SystemHealthData> = {}
  ): SystemHealthData => ({
    generated_at: '2026-08-13T08:00:00Z',
    status: 'ok',
    thresholds: { warning_percent: 80, critical_percent: 90 },
    disk: {
      status: 'ok',
      path: '/app/storage',
      total_bytes: 100 * 1024 * 1024 * 1024,
      used_bytes: 40 * 1024 * 1024 * 1024,
      free_bytes: 60 * 1024 * 1024 * 1024,
      used_percent: 40,
      history: [{ date: '2026-08-12', used_percent: 39 }],
    },
    uploads: {
      blob_count: 3,
      total_bytes: 3072,
      unattached_count: 1,
      by_kind: [
        { record_type: 'Club', name: 'logo', count: 2, total_bytes: 2048 },
      ],
      largest: [],
    },
    database: { size_bytes: 1024, largest_tables: [] },
    growth: {
      months: [
        { month: '2026-07', count: 1, total_bytes: 1024 },
        { month: '2026-08', count: 2, total_bytes: 2048 },
      ],
      avg_bytes_per_month: 1536,
      months_until_full: 12,
    },
    operations: {
      version: '1.77.0',
      environment: 'production',
      pending_migrations: false,
      rails_root_path: '/app',
    },
    ...overrides,
  });

  const blocked = (overrides: Partial<BlockedIp> = {}): BlockedIp => ({
    id: 1,
    ip: '198.51.100.5',
    reason: 'Dauerhaft 401',
    created_at: '2026-08-19T09:00:00Z',
    created_by_name: 'Daniel Kehne (dkehne)',
    ...overrides,
  });

  function setup() {
    service = jasmine.createSpyObj('SystemHealthService', [
      'getSystemHealth',
      'getSummary',
      'getBlockedIps',
      'createBlockedIp',
      'deleteBlockedIp',
    ]);
    // Vorgabe, damit die Kennzahlen-Tests nicht an der Sperrliste haengen.
    service.getBlockedIps.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [SystemIndexComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: SystemHealthService, useValue: service }],
    });

    fixture = TestBed.createComponent(SystemIndexComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lädt die Kennzahlen beim Öffnen', () => {
    setup();
    service.getSystemHealth.and.returnValue(of(health()));

    component.ngOnInit();

    expect(service.getSystemHealth).toHaveBeenCalled();
    expect(component.data?.disk.used_percent).toBe(40);
    expect(component.loading).toBeFalse();
    expect(component.loadError).toBeNull();
  });

  it('meldet einen fehlgeschlagenen Abruf statt still zu bleiben', () => {
    setup();
    service.getSystemHealth.and.returnValue(throwError(() => new Error('500')));

    component.ngOnInit();

    expect(component.loadError).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  it('formatiert Byte-Angaben mit Basis 1024 wie df auf dem Server', () => {
    setup();
    expect(component.formatBytes(0)).toBe('0 B');
    expect(component.formatBytes(1024)).toBe('1,0 KB');
    expect(component.formatBytes(1536)).toBe('1,5 KB');
    expect(component.formatBytes(5 * 1024 * 1024 * 1024)).toBe('5,0 GB');
  });

  it('färbt den Verlauf mit den Schwellen aus der Antwort', () => {
    setup();
    service.getSystemHealth.and.returnValue(of(health()));
    component.ngOnInit();

    expect(component.statusForPercent(79)).toBe('ok');
    expect(component.statusForPercent(80)).toBe('warning');
    expect(component.statusForPercent(90)).toBe('critical');
  });

  it('kennt ohne geladene Antwort keine Schwellen', () => {
    setup();
    expect(component.statusForPercent(95)).toBe('unknown');
  });

  // Ohne Scope-Übersetzungen im Spec liefert transloco den Schlüssel zurück.
  // Geprüft wird deshalb der gewählte Zweig, nicht der ausformulierte Text.
  it('nennt bei ferner Prognose nur noch die Größenordnung', () => {
    setup();
    service.getSystemHealth.and.returnValue(
      of(
        health({
          growth: {
            months: [],
            avg_bytes_per_month: 10,
            months_until_full: 36,
          },
        })
      )
    );
    component.ngOnInit();

    expect(component.forecastLabel).toContain('forecastYears');
  });

  it('nennt eine nahe Prognose in Monaten', () => {
    setup();
    service.getSystemHealth.and.returnValue(of(health()));
    component.ngOnInit();

    expect(component.forecastLabel).toContain('forecastMonths');
  });

  it('sagt bei fehlendem Wachstum, dass keine Aussage möglich ist', () => {
    setup();
    service.getSystemHealth.and.returnValue(
      of(
        health({
          growth: {
            months: [],
            avg_bytes_per_month: 0,
            months_until_full: null,
          },
        })
      )
    );
    component.ngOnInit();

    expect(component.forecastLabel).toContain('forecastUnknown');
  });

  it('rechnet die Balkenbreite am größten Monat', () => {
    setup();
    service.getSystemHealth.and.returnValue(of(health()));
    component.ngOnInit();

    expect(component.monthlyWidth(2048)).toBe(100);
    expect(component.monthlyWidth(1024)).toBe(50);
  });

  it('zeigt unbekannte Upload-Arten im Rohzustand statt als Leerstelle', () => {
    setup();
    expect(component.kindLabel('Widget', 'attachment')).toBe(
      'Widget / attachment'
    );
  });

  describe('Sperrliste', () => {
    it('lädt die Sperrliste beim Öffnen', () => {
      setup();
      service.getSystemHealth.and.returnValue(of(health()));
      service.getBlockedIps.and.returnValue(of([blocked()]));

      component.ngOnInit();

      expect(component.blockedIps.length).toBe(1);
      expect(component.blockedIpsLoadFailed).toBeFalse();
    });

    // Ein Ladefehler darf nicht wie eine leere Sperrliste aussehen — sonst
    // glaubt ein Admin, es sei nichts gesperrt, und traegt doppelt ein.
    it('unterscheidet Ladefehler von leerer Liste', () => {
      setup();
      service.getSystemHealth.and.returnValue(of(health()));
      service.getBlockedIps.and.returnValue(throwError(() => new Error('500')));

      component.ngOnInit();

      expect(component.blockedIpsLoadFailed).toBeTrue();
      expect(component.blockedIps).toEqual([]);
    });

    it('sperrt erst, wenn Adresse und Grund ausgefüllt sind', () => {
      setup();
      service.getSystemHealth.and.returnValue(of(health()));
      service.createBlockedIp.and.returnValue(of(blocked()));
      component.ngOnInit();

      expect(component.canSubmitBlock).toBeFalse();

      component.newIp = '198.51.100.5';
      expect(component.canSubmitBlock).toBeFalse();

      component.newReason = 'Dauerhaft 401';
      expect(component.canSubmitBlock).toBeTrue();

      component.addBlockedIp();
      expect(service.createBlockedIp).toHaveBeenCalledWith(
        '198.51.100.5',
        'Dauerhaft 401'
      );
    });

    it('räumt das Formular nach dem Sperren und ergänzt die Liste', () => {
      setup();
      service.getSystemHealth.and.returnValue(of(health()));
      service.createBlockedIp.and.returnValue(of(blocked({ id: 7 })));
      component.ngOnInit();

      component.newIp = '198.51.100.5';
      component.newReason = 'Dauerhaft 401';
      component.addBlockedIp();

      expect(component.blockedIps.map((b) => b.id)).toContain(7);
      expect(component.newIp).toBe('');
      expect(component.newReason).toBe('');
      expect(component.savingBlock).toBeFalse();
    });

    // Die Serverantwort nennt den Grund (unsinnige Adresse, eigenes Netz, schon
    // gesperrt). Der gehoert an das Formular — in einem Toast waere er beim
    // naechsten Klick weg, und der Admin wuesste nicht, was er aendern soll.
    it('zeigt die Begründung des Servers am Formular', () => {
      setup();
      service.getSystemHealth.and.returnValue(of(health()));
      service.createBlockedIp.and.returnValue(
        throwError(() => ({
          error: {
            errors: ['IP liegt im eigenen oder in einem privaten Netz'],
          },
        }))
      );
      component.ngOnInit();

      component.newIp = '172.18.0.3';
      component.newReason = 'Test';
      component.addBlockedIp();

      expect(component.blockError).toContain('privaten Netz');
      expect(component.savingBlock).toBeFalse();
      expect(component.newIp).toBe(
        '172.18.0.3',
        'Eingabe darf nicht verloren gehen'
      );
    });

    it('gibt nach Bestätigung frei und nimmt die Zeile aus der Liste', () => {
      setup();
      service.getSystemHealth.and.returnValue(of(health()));
      service.getBlockedIps.and.returnValue(of([blocked({ id: 7 })]));
      service.deleteBlockedIp.and.returnValue(of({}));
      component.ngOnInit();
      spyOn(window, 'confirm').and.returnValue(true);

      component.removeBlockedIp(blocked({ id: 7 }));

      expect(service.deleteBlockedIp).toHaveBeenCalledWith(7);
      expect(component.blockedIps).toEqual([]);
    });

    it('gibt ohne Bestätigung nicht frei', () => {
      setup();
      service.getSystemHealth.and.returnValue(of(health()));
      service.getBlockedIps.and.returnValue(of([blocked({ id: 7 })]));
      component.ngOnInit();
      spyOn(window, 'confirm').and.returnValue(false);

      component.removeBlockedIp(blocked({ id: 7 }));

      expect(service.deleteBlockedIp).not.toHaveBeenCalled();
      expect(component.blockedIps.length).toBe(1);
    });
  });
});
