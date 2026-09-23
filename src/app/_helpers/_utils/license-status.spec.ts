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

  describe('Zeitpunkte statt Text, wie LicenseEffectiveStatus (api#747)', () => {
    it('vergleicht gemischte Offsets als Zeitpunkte', () => {
      // 19:59+02:00 ist 17:59 UTC, also früher als 18:25 UTC, sortiert als
      // Text aber dahinter.
      const earlier = entry(1, '2026-09-01T19:59:00+02:00');
      const later = entry(8, '2026-09-01T18:25:00+00:00');

      expect(latestLicenseHistory([earlier, later])).toBe(later);
      expect(latestLicenseHistory([later, earlier])).toBe(later);
      expect(chronologicalLicenseHistory([later, earlier])).toEqual([
        earlier,
        later,
      ]);
    });

    it('liest "Z" und ".500+00:00" als Zeitpunkte', () => {
      const whole = entry(1, '2026-09-01T18:25:00Z');
      const half = entry(8, '2026-09-01T18:25:00.500+00:00');

      expect(latestLicenseHistory([half, whole])).toBe(half);
      expect(latestLicenseHistory([whole, half])).toBe(half);
    });

    it('lässt einen unlesbaren Zeitstempel gegen jeden lesbaren verlieren', () => {
      const dated = entry(1, '2020-01-01T00:00:00Z');
      const unreadable = entry(8, 'unbekannt');
      // Date.parse läse das, die API nicht: ohne JJJJ-MM-TT am Anfang undatiert.
      const usFormat = entry(3, '09/01/2026');

      expect(latestLicenseHistory([unreadable, dated])).toBe(dated);
      expect(latestLicenseHistory([dated, unreadable])).toBe(dated);
      expect(latestLicenseHistory([usFormat, dated])).toBe(dated);
      expect(chronologicalLicenseHistory([dated, unreadable])).toEqual([
        unreadable,
        dated,
      ]);
    });

    it('bricht gleiche Zeitpunkte über den Text', () => {
      const withOffset = entry(1, '2026-09-01T20:25:00+02:00');
      const utc = entry(8, '2026-09-01T18:25:00Z');

      // Gleicher Zeitpunkt, "2026-09-01T20…" ist als Text größer.
      expect(latestLicenseHistory([utc, withOffset])).toBe(withOffset);
      expect(latestLicenseHistory([withOffset, utc])).toBe(withOffset);
    });

    it('nimmt bei vollem Gleichstand den frühesten im Array, wie max_by', () => {
      const first = entry(1, '2026-09-01T18:25:00Z');
      const second = entry(8, '2026-09-01T18:25:00Z');

      expect(latestLicenseHistory([first, second])).toBe(first);
      expect(latestLicenseHistory([second, first])).toBe(second);
    });

    it('zeigt bei vollem Gleichstand den Status-Eintrag zuletzt', () => {
      const first = entry(1, '2026-09-01T18:25:00Z');
      const second = entry(8, '2026-09-01T18:25:00Z');
      const history = [first, second];

      const sorted = chronologicalLicenseHistory(history);

      expect(sorted[sorted.length - 1]).toBe(latestLicenseHistory(history)!);
    });
  });
});
