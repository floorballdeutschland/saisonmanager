import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/angular';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {
  buildSentryOptions,
  isHandledHttpNoise,
  isValidDsn,
  scrubBreadcrumbUrl,
  scrubEventUrls,
  scrubUrl,
} from './sentry-init';

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
    expect(options?.dataCollection?.userInfo).toBeFalse();
  });

  // Ohne diese Trennung mischen sich die Ereignisse des Testsystems unter die
  // des Produktivsystems — beide nutzen denselben DSN.
  it('tags the test system as staging', () => {
    environment.sentryDsn = dsn;
    environment.staging = true;

    expect(buildSentryOptions()?.environment).toBe('staging');
  });

  it('filters browser extension frames', () => {
    environment.sentryDsn = dsn;

    const options = buildSentryOptions();

    expect(
      options?.denyUrls?.some((pattern) =>
        (pattern as RegExp).test('chrome-extension://abc/content.js')
      )
    ).toBeTrue();
  });

  // Chunk-Ladefehler entstehen auch bei einem abgebrochenen scp-Deploy und sind
  // dann das wichtigste Warnsignal. Sie dürfen nicht stillschweigend wegfallen.
  it('does not filter chunk load errors', () => {
    environment.sentryDsn = dsn;

    expect(buildSentryOptions()?.ignoreErrors).not.toContain('ChunkLoadError');
  });

  // Ohne diese Angaben schickt Sentry Nutzerdaten, Cookies, Kopfzeilen,
  // Query-Parameter und Nachrichtenrümpfe mit — bei uns durchweg mit
  // personenbezogenem Inhalt.
  it('switches off every data category that could carry personal data', () => {
    environment.sentryDsn = dsn;

    const collection = buildSentryOptions()?.dataCollection;

    expect(collection?.userInfo).toBeFalse();
    expect(collection?.cookies).toBeFalse();
    expect(collection?.queryParams).toBeFalse();
    expect(collection?.httpBodies).toEqual([]);
  });

  it('leaves tracePropagationTargets unset so the same-origin default applies', () => {
    environment.sentryDsn = dsn;

    expect(buildSentryOptions()?.tracePropagationTargets).toBeUndefined();
  });
});

// Netzabbrüche und „nicht angemeldet" erzeugen bereits eine sichtbare Meldung
// über den ErrorInterceptor. Was in Sentry ankommt, ist die Dublette dazu — in
// den ersten Stunden nach Scharfschalten des DSN mit Abstand der häufigste
// Eintrag (SAISONMANAGER-2A: 27 Ereignisse, fast nur Mobilfunk und Bots).
describe('isHandledHttpNoise', () => {
  const httpError = (status: number) =>
    ({
      originalException: new HttpErrorResponse({
        status,
        url: 'https://saisonmanager.de/api/v2/init.json',
      }),
    }) as EventHint;

  it('verwirft einen abgebrochenen Request (Status 0)', () => {
    expect(isHandledHttpNoise(httpError(0))).toBeTrue();
  });

  it('verwirft „nicht angemeldet" (401)', () => {
    expect(isHandledHttpNoise(httpError(401))).toBeTrue();
  });

  // Ein 404 kann eine falsche Annahme im Frontend sein, ein 502 sieht nur der
  // Browser — die API meldet ihn nicht selbst, weil sie ihn nicht erzeugt hat.
  it('behält 404 und 5xx', () => {
    expect(isHandledHttpNoise(httpError(404))).toBeFalse();
    expect(isHandledHttpNoise(httpError(500))).toBeFalse();
    expect(isHandledHttpNoise(httpError(502))).toBeFalse();
  });

  // Der Filter darf an der Ausnahme hängen, nicht am Meldungstext: Ein
  // gewöhnlicher Fehler, der zufällig eine status-Eigenschaft mit 0 trägt, ist
  // kein Netzabbruch.
  it('greift nur bei einer HttpErrorResponse', () => {
    const fremd = { originalException: { status: 0 } } as EventHint;
    expect(isHandledHttpNoise(fremd)).toBeFalse();
    expect(
      isHandledHttpNoise({ originalException: new Error('x') } as EventHint)
    ).toBeFalse();
    expect(isHandledHttpNoise(undefined)).toBeFalse();
  });

  it('hängt am Status, nicht am Wortlaut der Angular-Meldung', () => {
    // Genau daran ging die vorhandene ignoreErrors-Liste vorbei: Angular baut
    // daraus „Http failure response for <url>: 0 Unknown Error", und keiner der
    // dortigen Einträge (Failed to fetch, NetworkError) passt darauf.
    const options = buildSentryOptions();
    expect(options?.ignoreErrors).not.toContain('Http failure response');
    expect(isHandledHttpNoise(httpError(0))).toBeTrue();
  });
});

describe('beforeSend', () => {
  const dsn = 'https://abc123@o1.ingest.de.sentry.io/456';

  beforeEach(() => {
    environment.sentryDsn = dsn;
  });

  it('verwirft das Ereignis eines Netzabbruchs', () => {
    const beforeSend = buildSentryOptions()?.beforeSend;
    const hint = {
      originalException: new HttpErrorResponse({ status: 0 }),
    } as EventHint;

    expect(beforeSend?.({} as ErrorEvent, hint)).toBeNull();
  });

  // Der Filter darf die Bereinigung nicht verdrängen: Ein Reset-Token im Pfad
  // ist ein lebendes Zugangsmittel und muss weiterhin herausfallen (#230).
  it('bereinigt weiterhin die URL eines gemeldeten Ereignisses', () => {
    const beforeSend = buildSentryOptions()?.beforeSend;
    const event = {
      request: { url: 'https://saisonmanager.de/neues-passwort/GEHEIM' },
    } as ErrorEvent;

    const result = beforeSend?.(event, {} as EventHint) as ErrorEvent;

    expect(result.request?.url).toBe(
      'https://saisonmanager.de/neues-passwort/[gefiltert]'
    );
  });
});

// Ein Passwort-Reset-Token ist ein lebendes Zugangsmittel, und ausgerechnet auf
// dieser Seite entstehen Fehler (Link abgelaufen, Passwort abgelehnt).
// dataCollection deckt die URL nicht ab, auch nicht mit queryParams: false.
describe('scrubUrl', () => {
  it('removes a password reset token from the path', () => {
    expect(
      scrubUrl('https://saisonmanager.de/neues-passwort/abc123def?x=1')
    ).toBe('https://saisonmanager.de/neues-passwort/[gefiltert]?x=1');
  });

  it('removes the one-time token of a referee feedback link', () => {
    expect(
      scrubUrl('https://saisonmanager.de/schiri-feedback/abgeben/tok99')
    ).toBe('https://saisonmanager.de/schiri-feedback/abgeben/[gefiltert]');
  });

  it('removes token and licence query parameters', () => {
    expect(
      scrubUrl('https://saisonmanager.de/email-bestaetigen?token=xy&a=1')
    ).toBe('https://saisonmanager.de/email-bestaetigen?token=[gefiltert]&a=1');
    expect(scrubUrl('https://saisonmanager.de/lizenzcheck?q=12345')).toBe(
      'https://saisonmanager.de/lizenzcheck?q=[gefiltert]'
    );
  });

  it('leaves harmless urls untouched', () => {
    const url = 'https://saisonmanager.de/verwaltung/teams/9885/bearbeiten';
    expect(scrubUrl(url)).toBe(url);
  });
});

describe('scrubEventUrls', () => {
  it('cleans the request url and the breadcrumbs of an event', () => {
    const event = {
      request: { url: 'https://saisonmanager.de/neues-passwort/secret' },
      breadcrumbs: [
        {
          data: {
            from: '/neues-passwort/secret',
            to: '/lizenzcheck?q=999',
            url: 'https://saisonmanager.de/email-bestaetigen?token=abc',
          },
        },
      ],
    } as unknown as ErrorEvent;

    const cleaned = scrubEventUrls(event);

    expect(cleaned.request?.url).toBe(
      'https://saisonmanager.de/neues-passwort/[gefiltert]'
    );
    const data = cleaned.breadcrumbs?.[0].data;
    expect(data?.['from']).toBe('/neues-passwort/[gefiltert]');
    expect(data?.['to']).toBe('/lizenzcheck?q=[gefiltert]');
    expect(data?.['url']).toBe(
      'https://saisonmanager.de/email-bestaetigen?token=[gefiltert]'
    );
  });

  it('copes with an event without request or breadcrumbs', () => {
    expect(() => scrubEventUrls({} as ErrorEvent)).not.toThrow();
  });
});

describe('scrubBreadcrumbUrl', () => {
  it('passes a breadcrumb without data through unchanged', () => {
    const crumb = { category: 'ui.click' } as Breadcrumb;
    expect(scrubBreadcrumbUrl(crumb)).toBe(crumb);
  });
});

// Ein DSN, den Sentry nicht lesen kann, erzeugt genau den Zustand, den dieser
// Fix behebt: init läuft, aber es wird nie etwas gesendet.
describe('isValidDsn', () => {
  it('accepts a well-formed dsn', () => {
    expect(isValidDsn('https://key123@o1.ingest.de.sentry.io/456')).toBeTrue();
  });

  it('rejects a dashboard url, a truncated dsn and a wrong scheme', () => {
    expect(
      isValidDsn('https://sentry.io/organizations/foo/projects/bar')
    ).toBeFalse();
    expect(isValidDsn('https://key123@o1.ingest.de.sentry.io')).toBeFalse();
    expect(isValidDsn('http://key123@o1.ingest.de.sentry.io/456')).toBeFalse();
  });

  // tr -d '[:space:]' über eine Datei mit zwei Zeilen ergab genau das, und der
  // Regex des SDK lässt es durch: gültige Form, aber falsches Projekt.
  it('rejects two concatenated dsns', () => {
    expect(
      isValidDsn(
        'https://a@o1.ingest.de.sentry.io/2https://b@o1.ingest.de.sentry.io/3'
      )
    ).toBeFalse();
  });
});
