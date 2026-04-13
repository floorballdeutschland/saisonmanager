"""
Extrahiert aktive Schiedsrichter aus der Schiedsrichterliste 2025.xlsx
und schreibt sie als referees_import.csv.

Aktiv = letzte Lizenz (col I) != '-' und nicht leer.
Lizenzstufe: col AL 'Vorläufige Lizenz' (Fallback auf col I falls AL leer).
Zusatzqualifikation: col N.
"""
import csv
import sys
from datetime import date

try:
    import openpyxl
except ImportError:
    print("openpyxl nicht installiert: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

XLSX = "/home/aniel_ehne/saisonmanager/Schiedsrichterliste 2025.xlsx"
OUT  = "/home/aniel_ehne/saisonmanager/scripts/referees_import.csv"

# Lizenzen gelten laut SRO §18 bis 30.09. des Folgejahres.
GUELTIGKEIT = "2025-09-30"

wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb.active

active = 0
skipped = 0

with open(OUT, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "lizenznummer", "nachname", "vorname", "geburtsdatum",
        "verein", "lizenzstufe", "zusatzqualifikation", "gueltigkeit"
    ])

    for row in ws.iter_rows(min_row=3, values_only=True):
        lizenznr      = row[0]    # col A – Lizenznummer
        nachname      = row[1]    # col B
        vorname       = row[2]    # col C
        geburt        = row[3]    # col D – Geburtsdatum
        verein        = row[4]    # col E
        letzte_lizenz = row[8]    # col I – letzte Lizenz (Filter: '-' = inaktiv)
        zusatz        = row[13]   # col N – Zusatzqualifikation
        vorl_lizenz   = row[37]   # col AL – Vorläufige Lizenz (= erteilte Lizenzstufe)

        # Nur numerische Lizenznummern
        if not isinstance(lizenznr, (int, float)):
            continue

        lizenznr = int(lizenznr)

        # Karriere beendet: col I ist '-' oder leer
        if not letzte_lizenz or str(letzte_lizenz).strip() == "-":
            skipped += 1
            continue

        # Geburtsdatum als ISO-String
        if geburt and hasattr(geburt, "strftime"):
            geburt_str = geburt.strftime("%Y-%m-%d")
        elif isinstance(geburt, str):
            geburt_str = geburt
        else:
            geburt_str = ""

        # Lizenzstufe: vorläufige Lizenz (AL) bevorzugt, Fallback auf col I
        vorl_str = str(vorl_lizenz).strip() if vorl_lizenz else ""
        letzt_str = str(letzte_lizenz).strip() if letzte_lizenz else ""
        lizenzstufe = vorl_str if vorl_str and vorl_str != "-" else letzt_str

        zusatz_str = str(zusatz).strip() if zusatz and str(zusatz).strip() != "-" else ""

        writer.writerow([
            lizenznr,
            (str(nachname) if nachname else "").strip(),
            (str(vorname)  if vorname  else "").strip(),
            geburt_str,
            (str(verein)   if verein   else "").strip(),
            lizenzstufe,
            zusatz_str,
            GUELTIGKEIT,
        ])
        active += 1

print(f"Exportiert: {active} aktive Schiedsrichter, {skipped} übersprungen (Karriere beendet)")
print(f"CSV: {OUT}")
