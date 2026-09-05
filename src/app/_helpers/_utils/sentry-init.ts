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
  //
  // `Failed to fetch` als Ausdruck und nicht als Zeichenkette, weil
  // `ignoreErrors` Zeichenketten als Teilstring vergleicht: Chromes
  // Chunk-Ladefehler heißt „Failed to fetch dynamically imported module" und
  // fiel damit unter diesen Filter, obwohl er ausdrücklich drinbleiben soll
  // (siehe unten). Das erklärt, warum SAISONMANAGER-2B fast nur aus Safari-
  // und iOS-Meldungen besteht — Chrome kam dort nie an.
  /Failed to fetch(?! dynamically imported module)/,
  'NetworkError',
  'Network request failed',
  'Load failed',
];

// Chunk-Ladefehler bleiben BEWUSST drin: Sie treten zwar harmlos auf, wenn der
// Nutzer nach einem Deploy noch die alte index.html hat, entstehen aber genauso
// bei einem abgebrochenen `scp` — und das ist der wichtigste Hinweis darauf,
// dass ein Deploy schiefgegangen ist. Deshalb kein Filter, sondern niedrigere
// Gewichtung durch den Nutzer im Dashboard.
//
// Behoben wird ein solcher Fehler seit chunk-load-recovery.ts durch ein
// einmaliges Neuladen. Die Meldung läuft davor, nicht danach — sonst wäre der
// Hinweis auf ein schiefgegangenes Deploy genau dann weg, wenn er gebraucht
// wird.

// Fehler, deren Stacktrace ausschließlich aus fremdem Code besteht: Erweiterungen,
// injizierte Skripte, Übersetzungsdienste. Nichts davon können wir beheben.
const DENIED_URLS = [
  /extensions\//i,
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
];

// Pfad-Segmente und Query-Parameter, die eine Zugangsberechtigung tragen. Sie
// dürfen Sentry nicht erreichen: Ein Passwort-Reset-Token ist ein lebendes
// Zugangsmittel, und ausgerechnet auf diesen Seiten entstehen Fehler (Link
// abgelaufen, Passwort abgelehnt).
const TOKEN_ROUTES = [
  /(\/neues-passwort\/)[^/?#]+/,
  /(\/schiri-feedback\/abgeben\/)[^/?#]+/,
];
const TOKEN_QUERY_PARAMS = ['token', 'q'];

/**
 * Ersetzt Zugangsdaten in einer URL durch `[gefiltert]`.
 *
 * `dataCollection` deckt Nutzerangaben, Cookies, Kopfzeilen und Query-Parameter
 * ab, aber NICHT den Pfad einer URL.
 * Sentry trägt sie an drei Stellen mit: `request.url`, Breadcrumbs und
 * Tracing-Spans. Der von `TraceService` parametrisierte Transaktions-*Name*
 * (`/neues-passwort/:resetToken`) sieht wie eine Bereinigung aus, ist aber nur
 * ein Label — die tatsächliche URL bleibt daneben stehen.
 */
export function scrubUrl(url: string): string {
  let cleaned = url;
  for (const route of TOKEN_ROUTES) {
    cleaned = cleaned.replace(route, '$1[gefiltert]');
  }
  for (const param of TOKEN_QUERY_PARAMS) {
    cleaned = cleaned.replace(
      new RegExp(`([?&]${param}=)[^&#]*`, 'gi'),
      '$1[gefiltert]'
    );
  }
  return cleaned;
}

/** Entfernt Zugangsdaten aus der URL eines Ereignisses. */
export function scrubEventUrls(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumbUrl);
  }
  return event;
}

/**
 * Entfernt Zugangsdaten aus einer Wegmarke.
 *
 * Wegmarken tragen die URL an zwei Stellen: als `data.from`/`data.to` bei
 * Navigationen und als `data.url` bei HTTP-Aufrufen.
 */
export function scrubBreadcrumbUrl(
  crumb: Sentry.Breadcrumb
): Sentry.Breadcrumb {
  if (!crumb.data) return crumb;
  for (const key of ['url', 'from', 'to']) {
    const value = crumb.data[key];
    if (typeof value === 'string') crumb.data[key] = scrubUrl(value);
  }
  return crumb;
}

/**
 * Ein DSN, den Sentry nicht lesen kann, ist genau der Fehler, den dieser PR
 * behebt: `init` läuft, es entsteht ein Client, aber es wird nie etwas
 * gesendet. Der SDK-Regex ist dabei nachlässig — zwei aneinandergehängte DSNs
 * passieren ihn — deshalb hier die strengere Prüfung.
 */
export function isValidDsn(dsn: string): boolean {
  return /^https:\/\/\w+@[\w.-]+\/\d+$/.test(dsn);
}

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

  // Nicht still weitermachen: Ein unbrauchbarer DSN sähe sonst exakt wie ein
  // funktionierendes Setup aus, nur dass nie ein Ereignis ankommt.
  if (!isValidDsn(dsn)) {
    console.error(
      'Sentry: DSN unbrauchbar, Fehlermeldung wird nicht gesendet.',
      dsn
    );
    return null;
  }

  return {
    dsn,
    // Trennt die Ereignisse des Testsystems von denen des Produktivsystems,
    // wie es die API über SENTRY_ENVIRONMENT bereits tut.
    environment: environment.staging ? 'staging' : 'production',
    // Als Array ergänzt die Liste die Standard-Integrationen statt sie zu
    // ersetzen — inboundFilters bleibt also aktiv, sonst wirkten ignoreErrors
    // und denyUrls unten gar nicht.
    integrations: [Sentry.browserTracingIntegration()],
    // Ein Zehntel der Aufrufe genügt, um Ausreißer zu erkennen. Die
    // Performance-Analyse läuft ohnehin über die API-Seite.
    tracesSampleRate: 0.1,
    // tracePropagationTargets bleibt bewusst ungesetzt: Der Browser-Standard
    // hängt Trace-Header nur an gleichnamige Herkunft, und Frontend und API
    // teilen sie. Eine eigene Liste würde nur die Treffermenge aufweichen
    // (Teilstring-Vergleich) und CORS-Fehler riskieren.
    ignoreErrors: IGNORED_ERRORS,
    denyUrls: DENIED_URLS,
    // Nachfolger des inzwischen abgekündigten sendDefaultPii, und feiner:
    // Neben Nutzerangaben, Cookies und Kopfzeilen lassen sich hier auch
    // Query-Parameter und Nachrichtenrümpfe abschalten. Beides trägt bei uns
    // personenbezogene Daten (Spieler- und Schiedsrichter-Datensätze, Tokens
    // in Links), und für die Fehlersuche brauchen wir nichts davon.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      queryParams: false,
    },
    // Ergänzt die Filter oben: Zugangsdaten stecken auch im Pfad, wo weder
    // queryParams noch denyUrls greifen.
    //
    // Hier stand der Filter für behandelte Netz- und Anmeldezustände, wie er
    // mit fe#239 kam. Er war wirkungslos: Sentrys ErrorHandler übergibt
    // `captureException` nicht die HttpErrorResponse, sondern das Ergebnis
    // seines Extractors, also eine Zeichenkette – `hint.originalException` ist
    // hier nie das ursprüngliche Objekt. Der Filter sitzt jetzt in
    // FilteringErrorHandler, wo die Ausnahme noch vorliegt.
    beforeSend: scrubEventUrls,
    beforeBreadcrumb: scrubBreadcrumbUrl,
  };
}

export function initSentry(): void {
  const options = buildSentryOptions();
  if (options) {
    Sentry.init(options);
    return;
  }
  // Beim Entwickeln benennen, dass nicht gesendet wird. Ein stummer Verzicht
  // ist genau das, was #230 so lange unbemerkt gelassen hat. In Produktion
  // bleibt es still, dort ist die Konsole nicht der richtige Ort.
  if (!environment.production) {
    console.info('Sentry ist aus (kein DSN in environment.sentryDsn).');
  }
}
