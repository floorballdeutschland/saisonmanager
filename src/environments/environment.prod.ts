export const environment = {
  production: true,
  staging: false,
  apiURL: 'https://saisonmanager.de/api/v2/',
  frontendApiKey: 'FRONTEND_API_KEY_PLACEHOLDER',
  // Wird von build-deploy.sh aus src/environments/.sentry-dsn ersetzt. Fehlt die
  // Datei, bleibt der Platzhalter stehen und Sentry startet nicht (siehe
  // initSentry): kein DSN, keine Übertragung.
  sentryDsn: 'SENTRY_DSN_PLACEHOLDER',
  // OAuth-Client-Kennung fuer das Anlegen der YouTube-Uebertragungen im
  // Browser. KEIN Geheimnis -- eine Client-ID ist oeffentlich und liegt ohnehin
  // im Bundle; geschuetzt ist der Zugang durch die zugelassenen Herkuenfte im
  // Google-Cloud-Projekt und durch die Anmeldung des Benutzers.
  // Wird von build-deploy.sh aus src/environments/.google-client-id ersetzt.
  // Fehlt die Datei, bleibt der Platzhalter stehen und der Knopf bleibt aus.
  googleClientId: 'GOOGLE_CLIENT_ID_PLACEHOLDER',
};
