import * as Sentry from '@sentry/angular';
import { environment } from 'src/environments/environment';

/**
 * Startet Sentry, sofern ein DSN hinterlegt ist.
 *
 * Vorher rief niemand `Sentry.init` auf. Die Provider in `app.module.ts`
 * (`createErrorHandler`, `TraceService`) sahen funktionsfähig aus, liefen aber
 * ohne Client ins Leere: `captureException` ohne initialisierten Client tut
 * nichts. Damit erreichte kein Frontend-Fehler das Monitoring (#230).
 *
 * Muss vor dem Bootstrap laufen, sonst entgehen Sentry die Fehler der
 * Startphase.
 */

// Meldungen, die nichts über den Saisonmanager aussagen. Ohne diese Filter
// besteht ein Browser-Projekt erfahrungsgemäß überwiegend aus Fremdrauschen,
// und die echten Fehler gehen darin unter.
const IGNORED_ERRORS = [
  // Vom Nutzer oder Browser abgebrochene Navigation bzw. Requests.
  'AbortError',
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  // Netzwerkabbrüche: sagen etwas über die Leitung, nicht über den Code. Der
  // ErrorInterceptor zeigt dem Nutzer dafür bereits eine Meldung.
  'Failed to fetch',
  'NetworkError',
  'Network request failed',
  'Load failed',
  // Chunk-Ladefehler nach einem Deploy: Der Nutzer hat noch die alte
  // index.html, die neuen Bundles heißen anders. Ein Reload behebt es.
  'ChunkLoadError',
  'Loading chunk',
  'Importing a module script failed',
  'error loading dynamically imported module',
];

// Fehler, deren Stacktrace ausschließlich aus fremdem Code besteht: Erweiterungen,
// injizierte Skripte, Übersetzungsdienste. Nichts davon können wir beheben.
const DENIED_URLS = [
  /extensions\//i,
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
];

/**
 * Baut die Sentry-Optionen, oder `null`, wenn nicht gesendet werden soll.
 *
 * Als eigene, reine Funktion, weil `Sentry.init` sich nicht durch einen Spy
 * ersetzen lässt (der ESM-Namespace ist schreibgeschützt) — die Weiche
 * „senden oder nicht" wäre sonst nicht prüfbar.
 */
export function buildSentryOptions(): Sentry.BrowserOptions | null {
  // Der Platzhalter bleibt stehen, wenn das Deploy-Skript keinen DSN einsetzen
  // konnte. Beide Fälle bedeuten: nicht senden.
  const dsn = environment.sentryDsn;
  if (!dsn || dsn === 'SENTRY_DSN_PLACEHOLDER') return null;

  return {
    dsn,
    // Trennt die Ereignisse des Testsystems von denen des Produktivsystems,
    // wie es die API über SENTRY_ENVIRONMENT bereits tut.
    environment: environment.staging ? 'staging' : 'production',
    integrations: [Sentry.browserTracingIntegration()],
    // Ein Zehntel der Aufrufe genügt, um Ausreißer zu erkennen. Die
    // Performance-Analyse läuft ohnehin über die API-Seite.
    tracesSampleRate: 0.1,
    // Ohne diese Liste hängt Sentry keine Trace-Header an fremde Aufrufe.
    tracePropagationTargets: ['saisonmanager.de', 'saisonmanager.dev'],
    ignoreErrors: IGNORED_ERRORS,
    denyUrls: DENIED_URLS,
    // Wir werten keine personenbezogenen Daten in Sentry aus; die Zuordnung zu
    // einem Konto brauchen wir für die Fehlersuche nicht.
    sendDefaultPii: false,
  };
}

export function initSentry(): void {
  const options = buildSentryOptions();
  if (options) Sentry.init(options);
}
