// Die Telefonnummer der Schiedsrichter ist ein Freitextfeld: Das Profil
// permittet sie ohne Validierung, und das Eingabefeld ist ein `type="tel"`,
// das seinerseits nichts prüft. Im Bestand steht deshalb alles von
// "0170 1234567" über "030 / 12 34 56" bis "0170 111111 (ab 18 Uhr)".
//
// Ein `tel:`-URI verträgt das nicht, und zwar auf zwei Arten still:
//
//  - `#` und `?` sind URL-Trennzeichen. Aus "030 1234567#22" (Durchwahl)
//    macht der Browser das Ziel `tel:030 1234567` und hängt den Rest als
//    Fragment an — es wird also eine gültige, aber falsche Nummer gewählt.
//  - Wer alle Nicht-Ziffern wegwirft, zieht aus "0170 1234567 (ab 18 Uhr)"
//    die "18" mit in die Nummer und wählt ebenfalls falsch.
//
// Beides ohne Fehlermeldung, bei einem Knopf, den jemand am Spieltag in Eile
// drückt. Deshalb zwei getrennte Werte: `telHref` baut ein Ziel, das ein
// Wähler verarbeiten kann, und die Anzeige zeigt weiter den Originaltext.
// Weicht die Eingabe ab, bleibt die Abweichung damit sichtbar, statt still
// weggeschnitten zu werden.

// Alles ab dem ersten Buchstaben ist ein Zusatz ("ab 18 Uhr", "oder ...",
// "privat"), keine Nummer. Umlaute mitgezählt, damit "ö" in "möglichst" nicht
// als Trennzeichen durchrutscht.
const FIRST_LETTER = /[A-Za-zÄÖÜäöüß]/;

// Wählbares Ziel für ein `href`, oder null, wenn nichts Wählbares übrig
// bleibt. Ein führendes `+` überlebt (Auslandsvorwahl), `*` und `#` bleiben
// als echte Wähltasten erhalten — `#` prozentkodiert, sonst schnitte es der
// Browser als Fragment ab. `null` statt eines leeren `tel:`: Ein Link, der
// ins Leere wählt, ist schlechter als kein Link.
export function telHref(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  // Zuerst den Klartext-Zusatz abschneiden, dann erst die Trennzeichen
  // entfernen. Andersherum wanderten dessen Ziffern in die Nummer.
  const letter = trimmed.search(FIRST_LETTER);
  const numeric = letter === -1 ? trimmed : trimmed.slice(0, letter);

  const plus = numeric.startsWith('+') ? '+' : '';
  const dialable = numeric.replace(/[^0-9*#]/g, '');
  // Eine einzelne Ziffer ist keine Nummer, sondern ein Vertipper. Vier ist die
  // kürzeste Länge, bei der eine echte (interne) Nummer denkbar bleibt.
  if (dialable.replace(/\D/g, '').length < 4) return null;

  return `tel:${plus}${dialable.replace(/#/g, '%23')}`;
}

// Anzeigetext zur Nummer: der Originaltext ohne umgebende Leerzeichen, oder
// null, wenn nichts übrig bleibt. Fängt den Fall "   " ab, den weder das
// Profil noch das Modell abschneidet und der sonst eine leere Zeile unter
// einer Überschrift "Telefon" ergäbe.
export function phoneText(raw: string | null | undefined): string | null {
  return raw?.trim() || null;
}
