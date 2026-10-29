#!/bin/bash
set -e

# Staging-Build + Deploy nach saisonmanager.dev.
#
# Wie build-deploy.sh, aber:
#   - baut mit Konfiguration "staging" (ohne Prerender/SSG – analog CI)
#   - braucht deshalb keinen API-Key: Der Browser holt sich wie in Prod eine
#     anonyme Sitzung (PublicSessionService), und ohne Prerender gibt es kein
#     Server-Rendering, das einen Key braeuchte
#   - deployt nach /opt/saisonmanager/saisonmanager-frontend-staging/

# Backup anlegen; trap stellt die Datei nach dem Build immer wieder her
cp src/environments/environment.staging.ts src/environments/environment.staging.ts.bak
trap 'mv src/environments/environment.staging.ts.bak src/environments/environment.staging.ts' EXIT

# Sentry-DSN einsetzen, sofern hinterlegt (optional, siehe build-deploy.sh).
# Derselbe DSN wie Prod; getrennt werden die Ereignisse über environment: 'staging'.
if [ -f "src/environments/.sentry-dsn" ]; then
  # Prüfungen wie in build-deploy.sh: leere Datei und unbrauchbarer DSN brechen
  # ab, statt einen Build ohne Monitoring als Erfolg zu melden.
  SENTRY_DSN=$(head -n1 src/environments/.sentry-dsn | tr -d '[:space:]')
  if [ -z "$SENTRY_DSN" ]; then
    echo "Fehler: src/environments/.sentry-dsn ist leer." >&2
    exit 1
  fi
  if ! echo "$SENTRY_DSN" | grep -qE '^https://[A-Za-z0-9]+@[A-Za-z0-9.-]+/[0-9]+$'; then
    echo "Fehler: Inhalt von .sentry-dsn sieht nicht wie ein DSN aus." >&2
    exit 1
  fi
  if ! grep -q "SENTRY_DSN_PLACEHOLDER" src/environments/environment.staging.ts; then
    echo "Fehler: SENTRY_DSN_PLACEHOLDER nicht in environment.staging.ts gefunden." >&2
    exit 1
  fi
  sed -i.sedbak "s|SENTRY_DSN_PLACEHOLDER|${SENTRY_DSN}|" src/environments/environment.staging.ts
  rm -f src/environments/environment.staging.ts.sedbak
  echo "Sentry-DSN eingesetzt."
else
  echo "Hinweis: src/environments/.sentry-dsn fehlt – Frontend-Sentry bleibt aus."
fi


# Google-Client-Kennung einsetzen, sofern hinterlegt. Wie beim Sentry-DSN
# optional: Ohne die Datei bleibt der Platzhalter stehen, und der Streaming-
# Bereich blendet das Anlegen der Uebertragungen aus, statt in einen
# Anmeldefehler zu laufen. Die Kennung ist kein Geheimnis (sie liegt ohnehin im
# Bundle); die Datei ist nur der Weg, sie nicht ins Repository zu schreiben,
# solange sie sich noch aendern kann.
if [ -f "src/environments/.google-client-id" ]; then
  GOOGLE_CLIENT_ID=$(head -n1 src/environments/.google-client-id | tr -d '[:space:]')
  if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "Fehler: src/environments/.google-client-id ist leer." >&2
    exit 1
  fi
  if ! echo "$GOOGLE_CLIENT_ID" | grep -qE '^[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com$'; then
    echo "Fehler: Inhalt von .google-client-id sieht nicht wie eine Client-ID aus." >&2
    echo "Erwartet: <nummer>-<kennung>.apps.googleusercontent.com" >&2
    exit 1
  fi
  if ! grep -q "GOOGLE_CLIENT_ID_PLACEHOLDER" src/environments/environment.staging.ts; then
    echo "Fehler: GOOGLE_CLIENT_ID_PLACEHOLDER nicht in src/environments/environment.staging.ts gefunden." >&2
    exit 1
  fi
  sed -i.sedbak "s|GOOGLE_CLIENT_ID_PLACEHOLDER|${GOOGLE_CLIENT_ID}|" src/environments/environment.staging.ts
  rm -f src/environments/environment.staging.ts.sedbak
  echo "Google-Client-Kennung eingesetzt."
else
  echo "Hinweis: src/environments/.google-client-id fehlt - Streams anlegen bleibt aus."
fi

# Build + Deploy
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

# Kein Prerender auf Staging (analog CI) – einfacher, keine Build-Zeit-API-Calls.
# Die staging-Config baut nach dist/saisonmanager-staging/ (eigener outputPath),
# damit ein paralleler Prod-build-deploy.sh (dist/saisonmanager/) nicht kollidiert.
./node_modules/.bin/ng build --configuration staging
scp -r dist/saisonmanager-staging/browser/* saisonmanager:/opt/saisonmanager/saisonmanager-frontend-staging/
