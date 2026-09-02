#!/usr/bin/env bash
#
# Baut die Übergangsgrafiken (Stinger) für OBS, eine je Wettbewerb.
#
# WARUM EINE DATEI UND KEINE BROWSER-QUELLE: Ein Stinger ist in OBS ein
# ÜBERGANG, und ein Übergang ist dort immer eine Mediendatei. Alles unter
# `overlay/` sind Browser-Quellen; sie liegen über einer Szene, sie sind keine
# Blende zwischen zweien. Deshalb liegt das Ergebnis als fertiges Video im Repo
# und wird nicht zur Laufzeit erzeugt.
#
# Format: WebM mit VP8 und Alphakanal (`yuva420p`, `alpha_mode=1`,
# `-auto-alt-ref 0`). Nicht VP9: VP8 mit Alpha ist der Weg, den OBS seit jeher
# abspielt, und die paar hundert Kilobyte Unterschied wiegen ein Risiko auf
# Sendung nicht auf.
#
# Ablauf (1,00 s bei 60 fps):
#
#   0,00 - 0,40 s  Die Fläche fährt von rechts ein, mit Akzentkante voran
#   0,40 - 0,62 s  Bild vollständig gedeckt, Ligazeichen sichtbar
#   0,62 - 1,00 s  Die Fläche fährt nach links aus, Akzentkante hinterher
#
# ÜBERGANGSZEITPUNKT: 500 ms. Der Wert gehört in OBS ins Feld
# „Übergangspunkt (ms)"; dort schneidet OBS von der einen auf die andere Szene.
# Er liegt in der Mitte der gedeckten Phase, der Schnitt ist also verdeckt.
#
# Aufruf (aus dem Repo-Wurzelverzeichnis):
#
#   scripts/build-stinger.sh            alle Wettbewerbe
#   scripts/build-stinger.sh pokal      nur einen
#
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="overlay/stinger"
mkdir -p "$OUT_DIR"

FPS=60
DURATION=1
WIDTH=1920
HEIGHT=1080

# Zeitmarken der drei Abschnitte, siehe Kopf.
T_IN=0.40
T_HOLD_END=0.62

# Grundfläche, aus overlay.css (`--ov-primary`, `--ov-secondary`).
PRIMARY=0x1a1a2e
SECONDARY=0x16213e

# Breite der vorauslaufenden Akzentkante.
EDGE=40

# Wettbewerb, Akzent, zweiter Akzentton, Bildmarke. Farben und Zuordnung stehen
# in `overlay/overlay.css` und `src/app/_helpers/_utils/competition-theme.ts`;
# hier müssen sie dieselben sein, sonst blendet die Übertragung in einer anderen
# Farbe über, als ihre Anzeigetafel trägt.
#
# `damen`, `neutral` und `regional` bekommen bewusst KEINE Bildmarke: Ein
# Zeichen ist eine Tatsachenbehauptung, und das sind gerade die Schlüssel für
# einen nicht zuzuordnenden Wettbewerb.
COMPETITIONS=(
  "1fbl-m|0xe94560|0xff6b35|overlay/img/1-fbl-herren-weiss.png"
  "1fbl-w|0xc86dd7|0x8e7bff|overlay/img/1-fbl-damen-weiss.png"
  "2fbl-m|0x2ec4b6|0x2b9bd8|overlay/img/2-fbl-herren-weiss.png"
  "2fbl-w|0x4fc46a|0xa5d63f|overlay/img/2-fbl-damen-weiss.png"
  "pokal|0xf2c14e|0xf9a03f|overlay/img/pokal-weiss.png"
  "damen|0xc86dd7|0x8e7bff|"
  "regional|0x7fb3ff|0x5b8def|"
  "neutral|0xe94560|0xff6b35|"
)

# Position der linken Kante der Fläche über die Zeit. Kubisch ein- und
# ausgeblendet: linear sieht nach Diagramm aus, nicht nach Sendung.
panel_x() {
  echo "if(lt(t,$T_IN), $WIDTH*pow(1-t/$T_IN,3), if(lt(t,$T_HOLD_END), 0, -$WIDTH*pow((t-$T_HOLD_END)/(1-$T_HOLD_END),3)))"
}

build() {
  local key="$1" accent="$2" accent_alt="$3" mark="$4"
  local out="$OUT_DIR/$key.webm"
  local x
  x="$(panel_x)"

  local inputs=(
    -f lavfi -t "$DURATION" -i "color=c=black@0.0:s=${WIDTH}x${HEIGHT}:r=$FPS,format=rgba"
    -f lavfi -t "$DURATION" -i "gradients=s=${WIDTH}x${HEIGHT}:c0=$PRIMARY:c1=$SECONDARY:x0=0:y0=0:x1=$WIDTH:y1=$HEIGHT:d=$DURATION:r=$FPS"
    -f lavfi -t "$DURATION" -i "color=c=$accent:s=${EDGE}x${HEIGHT}:r=$FPS"
    -f lavfi -t "$DURATION" -i "color=c=$accent_alt:s=${EDGE}x${HEIGHT}:r=$FPS"
  )

  # Fläche, dann die vorauslaufende Kante, dann die nachlaufende. Beide sitzen
  # außerhalb des Bildes, sobald die Fläche steht.
  local filter="[0][1]overlay=x='$x':y=0:format=rgb[a];"
  filter+="[a][2]overlay=x='($x)-$EDGE':y=0:format=rgb[b];"
  filter+="[b][3]overlay=x='($x)+$WIDTH':y=0:format=rgb[c]"

  if [ -n "$mark" ]; then
    inputs+=(-loop 1 -t "$DURATION" -i "$mark")
    # Das Zeichen erscheint erst, wenn die Fläche deckt, und ist weg, bevor sie
    # sich öffnet. Sonst stünde es einen Moment über dem Kamerabild.
    filter+=";[4]scale=-1:280,format=rgba,fade=t=in:st=0.40:d=0.07:alpha=1,fade=t=out:st=0.55:d=0.07:alpha=1[mark];"
    filter+="[c][mark]overlay=x=(W-w)/2:y=(H-h)/2:format=rgb[out]"
  else
    filter+=";[c]null[out]"
  fi

  ffmpeg -y -hide_banner -loglevel error \
    "${inputs[@]}" \
    -filter_complex "$filter" -map "[out]" \
    -c:v libvpx -pix_fmt yuva420p -auto-alt-ref 0 \
    -metadata:s:v:0 alpha_mode=1 \
    -b:v 3M -crf 16 -deadline good -cpu-used 0 \
    -r "$FPS" -t "$DURATION" \
    "$out"

  printf '%-10s %s\n' "$key" "$(du -h "$out" | cut -f1)"
}

for entry in "${COMPETITIONS[@]}"; do
  IFS='|' read -r key accent accent_alt mark <<<"$entry"
  if [ $# -gt 0 ] && [ "$1" != "$key" ]; then continue; fi
  build "$key" "$accent" "$accent_alt" "$mark"
done
