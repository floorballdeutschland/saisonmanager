/**
 * Setzt „Nachname, Vorname" aus zwei Freitextfeldern zusammen, so wie der
 * Spielbericht Schriftführer und Zeitnehmer ablegt.
 *
 * Das Komma ist das Trennzeichen und wird deshalb aus beiden Teilen entfernt,
 * und zwar überall im Wort: Ein `.replace(',', '')` träfe nur das erste
 * Vorkommen, ein zweites Komma hätte das Feld beim Zurücklesen zerteilt.
 *
 * Zwei Fehler der früheren Inline-Fassung behebt die Funktion:
 *
 * 1. Ein Template-Literal macht aus `undefined` die Zeichenkette „undefined".
 *    Wer nur den Vornamen eintrug, speicherte damit „undefined, Carolina", und
 *    genau so stand es im Spielbericht. Auf Prod 79 Schriftführer- und 85
 *    Zeitnehmer-Einträge.
 * 2. Die Teile wurden ungetrimmt übernommen. Ein versehentliches Leerzeichen am
 *    Ende der Eingabe landete unverändert in der Datenbank, auf Prod bei 1408
 *    bzw. 1346 Spielen.
 *
 * Das Ergebnis muss durch `fieldValue.split(', ')` wieder in dieselben zwei
 * Felder zerfallen. Deshalb bleibt das Trennzeichen erhalten, sobald ein
 * Vorname da ist: „, Carolina" liest sich wieder als Vorname, ein bloßes
 * „Carolina" wäre zum Nachnamen geworden.
 */
// Das Komma ist das Trennzeichen und wird deshalb überall entfernt, nicht nur
// beim ersten Vorkommen.
//
// „undefined" wird verworfen: Ein Altbestand wie „Ziegler, undefined" wird beim
// Öffnen des Berichts über split(', ') in die beiden Eingabefelder verteilt,
// das Wort steht dann sichtbar im Vornamensfeld. Ohne diese Zeile schriebe das
// nächste Speichern es unverändert zurück, und die Altzeile wäre über die
// Oberfläche nie loszuwerden.
function namePart(value?: string): string {
  const cleaned = (value ?? '').replace(/,/g, '').trim();
  return cleaned === 'undefined' ? '' : cleaned;
}

export function personName(lastname?: string, firstname?: string): string {
  const last = namePart(lastname);
  const first = namePart(firstname);

  // Beide leer: das Feld wird geleert, nicht auf „, " gesetzt.
  if (!last && !first) return '';
  if (!first) return last;
  return `${last}, ${first}`;
}

/**
 * Gegenstück zu personName: zerlegt den gespeicherten Wert wieder in die beiden
 * Eingabefelder.
 *
 * Getrennt wird ausschließlich am ERSTEN „, ". Ein schlichtes
 * `split(', ')` mit Zugriff auf [0] und [1] ließ bei Altbeständen mit mehreren
 * Kommata alles ab dem dritten Teil unter den Tisch fallen: Aus
 * „van der, Berg, Jan" wurden die Felder „van der" und „Berg", und das nächste
 * Speichern schrieb den verkürzten Namen zurück. Der Vorname ging dabei
 * stillschweigend verloren.
 */
export function splitPersonName(
  value: string
): [string, string | undefined] {
  const separator = value.indexOf(', ');
  if (separator === -1) return [value, undefined];

  return [value.slice(0, separator), value.slice(separator + 2)];
}
