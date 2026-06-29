#!/bin/bash
set -e

# Staging-Build + Deploy nach saisonmanager.dev.
#
# Wie build-deploy.sh, aber:
#   - ersetzt den API-Key-Platzhalter in environment.staging.ts
#   - baut mit Konfiguration "staging" (ohne Prerender/SSG – analog CI)
#   - deployt nach /opt/saisonmanager/saisonmanager-frontend-staging/
#
# Der Frontend-API-Key ist derselbe wie in Prod: die Staging-DB ist ein
# (anonymisierter) Klon der Prod-DB, die ApiKey-Tabelle bleibt dabei gültig.

# API-Key aus gitignorierter lokaler Datei lesen
if [ ! -f "src/environments/.api-key" ]; then
  echo "Fehler: src/environments/.api-key nicht gefunden." >&2
  echo "Datei anlegen und den Frontend-API-Key eintragen:" >&2
  echo "  echo \"<key>\" > src/environments/.api-key" >&2
  exit 1
fi
API_KEY=$(tr -d '[:space:]' < src/environments/.api-key)
if [ -z "$API_KEY" ]; then
  echo "Fehler: src/environments/.api-key ist leer." >&2
  exit 1
fi

# Backup anlegen; trap stellt die Datei nach dem Build immer wieder her
cp src/environments/environment.staging.ts src/environments/environment.staging.ts.bak
trap 'mv src/environments/environment.staging.ts.bak src/environments/environment.staging.ts' EXIT

# Sicherstellen dass der Platzhalter noch vorhanden ist
if ! grep -q "FRONTEND_API_KEY_PLACEHOLDER" src/environments/environment.staging.ts; then
  echo "Fehler: FRONTEND_API_KEY_PLACEHOLDER nicht in environment.staging.ts gefunden." >&2
  exit 1
fi

# Platzhalter durch echten Key ersetzen (| als Delimiter, sicher für Hex-Keys)
sed -i "s|FRONTEND_API_KEY_PLACEHOLDER|${API_KEY}|" src/environments/environment.staging.ts

# Build + Deploy
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

# Kein Prerender auf Staging (analog CI) – einfacher, keine Build-Zeit-API-Calls.
./node_modules/.bin/ng build --configuration staging
scp -r dist/saisonmanager/browser/* saisonmanager:/opt/saisonmanager/saisonmanager-frontend-staging/
