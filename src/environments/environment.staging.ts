export const environment = {
  production: true,
  staging: true,
  apiURL: 'https://saisonmanager.dev/api/v2/',
  frontendApiKey: 'FRONTEND_API_KEY_PLACEHOLDER',
  // Wird von build-deploy-staging.sh aus src/environments/.sentry-dsn ersetzt.
  // Ereignisse landen im selben Projekt, getrennt über environment: 'staging'.
  sentryDsn: 'SENTRY_DSN_PLACEHOLDER',
};
