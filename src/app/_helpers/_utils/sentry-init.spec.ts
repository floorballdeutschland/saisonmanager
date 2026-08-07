import { environment } from 'src/environments/environment';
import { buildSentryOptions } from './sentry-init';

// Der Kern dieses Moduls ist eine Weiche: senden oder eben nicht. Genau die hat
// gefehlt (#230), und ein versehentlich fehlender DSN sähe im Betrieb wieder
// exakt wie ein funktionierendes Setup aus.
describe('buildSentryOptions', () => {
  const originalDsn = environment.sentryDsn;
  const originalStaging = environment.staging;
  const dsn = 'https://key@o1.ingest.de.sentry.io/2';

  afterEach(() => {
    environment.sentryDsn = originalDsn;
    environment.staging = originalStaging;
  });

  it('returns null without a dsn, so nothing is sent', () => {
    environment.sentryDsn = '';

    expect(buildSentryOptions()).toBeNull();
  });

  // Bleibt der Platzhalter stehen, konnte das Deploy-Skript keinen DSN
  // einsetzen. Dann darf Sentry nicht mit einer unbrauchbaren Adresse starten.
  it('returns null when the placeholder was not replaced', () => {
    environment.sentryDsn = 'SENTRY_DSN_PLACEHOLDER';

    expect(buildSentryOptions()).toBeNull();
  });

  it('passes the dsn through and tags production', () => {
    environment.sentryDsn = dsn;
    environment.staging = false;

    const options = buildSentryOptions();

    expect(options?.dsn).toBe(dsn);
    expect(options?.environment).toBe('production');
    expect(options?.sendDefaultPii).toBeFalse();
  });

  // Ohne diese Trennung mischen sich die Ereignisse des Testsystems unter die
  // des Produktivsystems — beide nutzen denselben DSN.
  it('tags the test system as staging', () => {
    environment.sentryDsn = dsn;
    environment.staging = true;

    expect(buildSentryOptions()?.environment).toBe('staging');
  });

  it('filters deploy-related chunk errors and browser extension frames', () => {
    environment.sentryDsn = dsn;

    const options = buildSentryOptions();

    expect(options?.ignoreErrors).toContain('ChunkLoadError');
    expect(
      options?.denyUrls?.some((pattern) =>
        (pattern as RegExp).test('chrome-extension://abc/content.js')
      )
    ).toBeTrue();
  });
});
