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
export function personName(lastname?: string, firstname?: string): string {
  const last = (lastname ?? '').replace(/,/g, '').trim();
  const first = (firstname ?? '').replace(/,/g, '').trim();

  // Beide leer: das Feld wird geleert, nicht auf „, " gesetzt.
  if (!last && !first) return '';
  if (!first) return last;
  return `${last}, ${first}`;
}
