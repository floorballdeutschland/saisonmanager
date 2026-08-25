import { TestBed } from '@angular/core/testing';

import { LicenseUserLeagueDetailComponent } from './license-user-league-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { getTranslocoTestingModule } from '@floorball/core';

describe('LicenseUserLeagueDetailComponent', () => {
  const STORAGE_KEY = 'licenseListShowDates';

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LicenseUserLeagueDetailComponent],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  const create = () => {
    const fixture = TestBed.createComponent(LicenseUserLeagueDetailComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('should create', () => {
    const fixture = TestBed.createComponent(LicenseUserLeagueDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('zeigt die Datumsangaben ohne gespeicherte Wahl an', () => {
    expect(create().showDates).toBeTrue();
  });

  it('merkt sich das Abwählen über den Aufruf hinaus', () => {
    create().toggleDates(false);

    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LicenseUserLeagueDetailComponent],
    });

    expect(create().showDates).toBeFalse();
  });

  it('zeigt die Datumsangaben, wenn localStorage nicht lesbar ist', () => {
    spyOn(localStorage, 'getItem').and.throwError('SecurityError');

    expect(create().showDates).toBeTrue();
  });

  it('bleibt bedienbar, wenn localStorage nicht schreibbar ist', () => {
    spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
    const component = create();

    expect(() => component.toggleDates(false)).not.toThrow();
    expect(component.showDates).toBeFalse();
  });
});
