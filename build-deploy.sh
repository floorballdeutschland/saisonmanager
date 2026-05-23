#!/bin/bash
set -e

# API-Key aus gitignorierter lokaler Datei lesen
if [ ! -f "src/environments/.api-key" ]; then
  echo "Fehler: src/environments/.api-key nicht gefunden." >&2
  echo "Datei anlegen und den Frontend-API-Key eintragen:" >&2
  echo "  echo \"<key>\" > src/environments/.api-key" >&2
  exit 1
fi
API_KEY=$(tr -d '[:space:]' < src/environments/.api-key)

# Backup anlegen; trap stellt die Datei nach dem Build immer wieder her
cp src/environments/environment.prod.ts src/environments/environment.prod.ts.bak
trap 'mv src/environments/environment.prod.ts.bak src/environments/environment.prod.ts' EXIT

# Platzhalter durch echten Key ersetzen
sed -i "s/FRONTEND_API_KEY_PLACEHOLDER/$API_KEY/" src/environments/environment.prod.ts

# Build + Deploy
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
ng build
scp -r dist/saisonmanager/browser/* saisonmanager:/opt/saisonmanager/saisonmanager-frontend/
