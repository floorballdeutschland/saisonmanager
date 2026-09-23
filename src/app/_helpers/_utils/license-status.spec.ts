import { PlayerLicenseHistory } from '@floorball/types';
import {
  chronologicalLicenseHistory,
  isActiveLicenseHistory,
  isSuspendedStatus,
  latestLicenseHistory,
  licenseStatusBadgeClass,
  LICENSE_STATUS_SUSPENDED,
} from './license-status';

describe('licenseStatusBadgeClass', () => {
  it('hebt gesperrt rot hervor wie eine Ablehnung', () => {
    // Vor api#605 fiel `gesperrt` in den grauen Rest und war von
    // „zurückgezogen" nicht zu unterscheiden.
    expect(licenseStatusBadgeClass(LICENSE_STATUS_SUSPENDED)).toContain('red');
    expect(licenseStatusBadgeClass(3)).toContain('red');
  });

  it('erteilt grün, beantragt gelb, alles andere grau', () => {
    expect(licenseStatusBadgeClass(1)).toContain('green');
    expect(licenseStatusBadgeClass(2)).toContain('yellow');
    expect(licenseStatusBadgeClass(8)).toContain('gray');
    expect(licenseStatusBadgeClass(undefined)).toContain('gray');
  });
});

describe('isSuspendedStatus', () => {
  it('erkennt die 9, auch als Zeichenkette aus JSONB', () => {
    expect(isSuspendedStatus(9)).toBe(true);
    expect(isSuspendedStatus('9' as unknown as number)).toBe(true);
    expect(isSuspendedStatus(1)).toBe(false);
    expect(isSuspendedStatus(null)).toBe(false);
  });
});

describe('Lizenzverlauf', () => {
  function entry(statusId: number, createdAt?: string): PlayerLicenseHistory {
    return {
      license_status_id: statusId,
      created_at: createdAt,
    } as unknown as PlayerLicenseHistory;
  }

  // Wie nach einem Spieler-Merge: der jüngere Eintrag (geloescht) steht vorn,
  // weil die Verläufe zweier Profile aneinandergehängt wurden.
  const merged = [
    entry(1, '2026-08-01T10:00:00.000+00:00'),
    entry(8, '2026-09-01T10:00:00.000+00:00'),
    entry(2, '2026-07-01T10:00:00.000+00:00'),
  ];

  it('latestLicenseHistory nimmt den jüngsten, nicht den letzten Eintrag', () => {
    expect(latestLicenseHistory(merged)?.license_status_id).toBe(8);
  });

  it('latestLicenseHistory kommt mit leerer und fehlender History aus', () => {
    expect(latestLicenseHistory([])).toBeUndefined();
    expect(latestLicenseHistory(undefined)).toBeUndefined();
  });

  it('isActiveLicenseHistory folgt dem jüngsten Eintrag', () => {
    expect(isActiveLicenseHistory(merged)).toBe(false);
    expect(
      isActiveLicenseHistory([
        entry(8, '2026-07-01T10:00:00.000+00:00'),
        entry(1, '2026-08-01T10:00:00.000+00:00'),
        entry(3, '2026-06-01T10:00:00.000+00:00'),
      ])
    ).toBe(true);
  });

  it('isActiveLicenseHistory liest die Status-ID auch als Zeichenkette', () => {
    expect(
      isActiveLicenseHistory([entry('2' as unknown as number, '2026-01-01')])
    ).toBe(true);
    expect(isActiveLicenseHistory(undefined)).toBe(false);
  });

  it('chronologicalLicenseHistory sortiert aufsteigend, ohne das Original zu ändern', () => {
    const sorted = chronologicalLicenseHistory(merged);

    expect(sorted.map((h) => h.license_status_id)).toEqual([2, 1, 8]);
    expect(merged.map((h) => h.license_status_id)).toEqual([1, 8, 2]);
  });

  it('chronologicalLicenseHistory stellt undatierte Einträge nach vorn', () => {
    const sorted = chronologicalLicenseHistory([
      entry(1, '2026-08-01'),
      entry(4),
    ]);

    expect(sorted.map((h) => h.license_status_id)).toEqual([4, 1]);
  });
});
