import {
  isSuspendedStatus,
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
