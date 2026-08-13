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
#
# `sed -i.sedbak` statt `sed -i`: BSD-sed (macOS) verlangt hinter -i zwingend
# eine Endung und nimmt sonst den Ausdruck dafür, danach die Datei als Ausdruck.
# Das bricht mit "bad flag in substitute command" ab, bevor irgendetwas ersetzt
# ist. Mit Endung verhalten sich BSD und GNU gleich.
#
# NICHT `.bak`: Diese Endung gehoert der Sicherung oben, die der trap nach dem
# Build zurueckspielt. sed wuerde sie ueberschreiben und das anschliessende
# Aufraeumen sie loeschen -- der trap fände dann nichts mehr vor und liesse den
# echten Schluessel in der Arbeitskopie stehen.
sed -i.sedbak "s|FRONTEND_API_KEY_PLACEHOLDER|${API_KEY}|" src/environments/environment.prod.ts
rm -f src/environments/environment.prod.ts.sedbak

# Sentry-DSN einsetzen, sofern hinterlegt. Anders als beim API-Key ist das
# optional: Ohne die Datei bleibt der Platzhalter stehen, und initSentry()
# startet Sentry dann nicht (statt eine kaputte Adresse zu verwenden). Der DSN
# eines Browser-SDK ist zwangsläufig öffentlich, er landet im Bundle.
if [ -f "src/environments/.sentry-dsn" ]; then
  # Nur die erste Zeile: tr -d würde einen Kommentar oder einen zweiten DSN
  # sonst zu einer scheinbar gültigen Adresse zusammenkleben.
  SENTRY_DSN=$(head -n1 src/environments/.sentry-dsn | tr -d '[:space:]')
  # Leere Datei wie beim API-Key abbrechen, statt einen Build ohne Monitoring
  # als Erfolg zu melden.
  if [ -z "$SENTRY_DSN" ]; then
    echo "Fehler: src/environments/.sentry-dsn ist leer." >&2
    exit 1
  fi
  if ! echo "$SENTRY_DSN" | grep -qE '^https://[A-Za-z0-9]+@[A-Za-z0-9.-]+/[0-9]+$'; then
    echo "Fehler: Inhalt von .sentry-dsn sieht nicht wie ein DSN aus." >&2
    echo "Erwartet: https://<key>@<host>/<projekt-id>" >&2
    exit 1
  fi
  if ! grep -q "SENTRY_DSN_PLACEHOLDER" src/environments/environment.prod.ts; then
    echo "Fehler: SENTRY_DSN_PLACEHOLDER nicht in environment.prod.ts gefunden." >&2
    exit 1
  fi
  # @ und / im DSN kollidieren mit gängigen sed-Delimitern, | kommt darin nicht vor.
  sed -i.sedbak "s|SENTRY_DSN_PLACEHOLDER|${SENTRY_DSN}|" src/environments/environment.prod.ts
  rm -f src/environments/environment.prod.ts.sedbak
  echo "Sentry-DSN eingesetzt."
else
  echo "Hinweis: src/environments/.sentry-dsn fehlt – Frontend-Sentry bleibt aus."
fi

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
