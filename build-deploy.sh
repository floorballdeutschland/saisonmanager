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
if [ -z "$API_KEY" ]; then
  echo "Fehler: src/environments/.api-key ist leer." >&2
  exit 1
fi

# Backup anlegen; trap stellt die Datei nach dem Build immer wieder her
cp src/environments/environment.prod.ts src/environments/environment.prod.ts.bak
trap 'mv src/environments/environment.prod.ts.bak src/environments/environment.prod.ts' EXIT

# Sicherstellen dass der Platzhalter noch vorhanden ist
if ! grep -q "FRONTEND_API_KEY_PLACEHOLDER" src/environments/environment.prod.ts; then
  echo "Fehler: FRONTEND_API_KEY_PLACEHOLDER nicht in environment.prod.ts gefunden." >&2
  exit 1
fi

# Platzhalter durch echten Key ersetzen (| als Delimiter, sicher für Hex-Keys)
sed -i "s|FRONTEND_API_KEY_PLACEHOLDER|${API_KEY}|" src/environments/environment.prod.ts

# Build + Deploy
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

# Prerender-Routen (öffentliche FD-Ligen der laufenden Saison) frisch generieren.
# Schlägt der API-Aufruf fehl, bleibt die eingecheckte prerender-routes.txt erhalten.
FRONTEND_API_KEY="${API_KEY}" node scripts/generate-prerender-routes.mjs

# Prerender (SSG) läuft nur hier beim Deploy – nur jetzt liegen API-Key und
# Routenliste vor. Die CI baut bewusst ohne Prerender (Config "production"),
# da ihr beides fehlt und der Render sonst an 401ern hängenbliebe.
./node_modules/.bin/ng build --configuration production,prerender
scp -r dist/saisonmanager/browser/* saisonmanager:/opt/saisonmanager/saisonmanager-frontend/
