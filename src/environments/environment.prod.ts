export const environment = {
  production: true,
  staging: false,
  apiURL: 'https://saisonmanager.de/api/v2/',
  frontendApiKey: 'FRONTEND_API_KEY_PLACEHOLDER',
  // Wird von build-deploy.sh aus src/environments/.sentry-dsn ersetzt. Fehlt die
  // Datei, bleibt der Platzhalter stehen und Sentry startet nicht (siehe
  // initSentry): kein DSN, keine Übertragung.
  sentryDsn: 'SENTRY_DSN_PLACEHOLDER',
};
