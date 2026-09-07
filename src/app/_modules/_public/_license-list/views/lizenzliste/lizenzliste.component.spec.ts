import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { LizenzlisteComponent } from './lizenzliste.component';
import { PublicLicenseEntry } from '@floorball/types';

// Die Lizenzliste hinter dem oeffentlichen Link. Am Kampfgericht wird an ihr
// die Spielberechtigung abgelesen, deshalb hat die Statusspalte hier Gewicht.
describe('LizenzlisteComponent', () => {
  let component: LizenzlisteComponent;
  let fixture: ComponentFixture<LizenzlisteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // CommonModule wegen der date-Pipe der Spalten „Genehmigt am" und
      // „Gueltig bis"; NO_ERRORS_SCHEMA fuer die Bausteine aus dem UIKit.
      imports: [HttpClientTestingModule, CommonModule],
      declarations: [LizenzlisteComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ token: 'tok' }) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LizenzlisteComponent);
    component = fixture.componentInstance;
  });

  const render = (entries: Partial<PublicLicenseEntry>[]) => {
    component.data = {
      game: { date: '2026-01-01', league_name: 'Herren GF' },
      home_team_licenses: entries as PublicLicenseEntry[],
      guest_team_licenses: [],
      expires_at: '2026-01-02T00:00:00Z',
    } as (typeof component)['data'];
    component.loading = false;
    fixture.detectChanges();

    return Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr td:nth-child(3)')
    ).map((el) => (el as HTMLElement).textContent?.trim() ?? '');
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Die Bezeichnungen kommen aus License::NAMES und sind kleingeschrieben.
  // Verglichen wurde mit „Genehmigt"/„Beantragt", also mit Schreibweisen, die
  // die API nie geschickt hat: Jede Zeile landete in der grauen Sammelfarbe.
  describe('Status der Zeile', () => {
    it('benennt und faerbt die Status, die die API schickt', () => {
      expect(component.statusLabel('erteilt')).toBe('Lizenziert');
      expect(component.statusClass('erteilt')).toContain('text-green-700');
      expect(component.statusLabel('beantragt')).toBe('Beantragt');
      expect(component.statusClass('beantragt')).toContain('text-yellow-700');
    });

    it('hebt eine gesperrte Lizenz rot hervor', () => {
      expect(component.statusLabel('gesperrt')).toBe('Gesperrt');
      expect(component.statusClass('gesperrt')).toContain('text-red-700');
    });

    it('gibt einen unbekannten Status unveraendert weiter', () => {
      expect(component.statusLabel('zurückgezogen')).toBe('zurückgezogen');
      expect(component.statusClass('zurückgezogen')).toContain(
        'text-fb-gray-400'
      );
    });
  });

  describe('Sperre in der Liste', () => {
    // Am Spieltisch zaehlt, WO die Sperre gilt: Dieselbe Lizenz kann in der
    // Liga gesperrt und im Pokal erteilt sein.
    it('nennt den Geltungsbereich der Sperre', () => {
      const [zeile] = render([
        {
          name: 'Anna Meier',
          license_status: 'gesperrt',
          suspension_scope: 'Herren Großfeld, Ligaspielbetrieb',
        },
      ]);

      expect(zeile).toContain('Gesperrt');
      expect(zeile).toContain('Herren Großfeld, Ligaspielbetrieb');
    });

    it('laesst eine erteilte Zeile ohne Zusatz', () => {
      const [zeile] = render([
        { name: 'Anna Meier', license_status: 'erteilt' },
      ]);

      expect(zeile).toBe('Lizenziert');
    });
  });
});
