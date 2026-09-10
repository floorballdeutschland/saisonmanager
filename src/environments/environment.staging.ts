export const environment = {
  production: true,
  staging: true,
  apiURL: 'https://saisonmanager.dev/api/v2/',
  frontendApiKey: 'FRONTEND_API_KEY_PLACEHOLDER',
  // Wird von build-deploy-staging.sh aus src/environments/.sentry-dsn ersetzt.
  // Ereignisse landen im selben Projekt, getrennt über environment: 'staging'.
  sentryDsn: 'SENTRY_DSN_PLACEHOLDER',
  // OAuth-Client-Kennung fuer das Anlegen der YouTube-Uebertragungen im
  // Browser. KEIN Geheimnis -- eine Client-ID ist oeffentlich und liegt ohnehin
  // im Bundle; geschuetzt ist der Zugang durch die zugelassenen Herkuenfte im
  // Google-Cloud-Projekt und durch die Anmeldung des Benutzers.
  // Wie in der Produktion, aus derselben Datei.
  googleClientId: 'GOOGLE_CLIENT_ID_PLACEHOLDER',
};
