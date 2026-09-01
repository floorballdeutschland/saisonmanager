import { phoneText, telHref } from './phone-link';

describe('telHref', () => {
  it('entfernt Trennzeichen aus dem Waehlziel', () => {
    expect(telHref('0170 1234567')).toBe('tel:01701234567');
    expect(telHref('030 / 12 34 56')).toBe('tel:030123456');
    expect(telHref('(0170) 123-4567')).toBe('tel:01701234567');
  });

  it('behaelt die fuehrende Auslandsvorwahl', () => {
    expect(telHref('+49 170 1234567')).toBe('tel:+491701234567');
  });

  // Der erste Grund fuer diese Funktion: `#` ist ein URL-Trennzeichen. Roh in
  // ein href gehaengt waehlt der Browser "tel:030 1234567" und wirft die
  // Durchwahl als Fragment weg -- eine gueltige, aber falsche Nummer, ohne
  // Fehlermeldung. Prozentkodiert bleibt sie als Waehltaste erhalten.
  it('rettet die Durchwahl hinter einer Raute in das Waehlziel', () => {
    expect(telHref('030 1234567#22')).toBe('tel:0301234567%2322');
  });

  // Der zweite Grund: Wer stumpf alle Nicht-Ziffern wegwirft, zieht die "18"
  // aus dem Zusatz in die Nummer und waehlt ebenfalls falsch.
  it('laesst die Ziffern eines Klartext-Zusatzes nicht in die Nummer', () => {
    expect(telHref('0170 1234567 (ab 18 Uhr)')).toBe('tel:01701234567');
    expect(telHref('0170 111111 oder 030 222222')).toBe('tel:0170111111');
  });

  it('liefert null, wenn nichts Waehlbares uebrig bleibt', () => {
    expect(telHref(null)).toBeNull();
    expect(telHref(undefined)).toBeNull();
    expect(telHref('')).toBeNull();
    expect(telHref('   ')).toBeNull();
    expect(telHref('bitte per Mail')).toBeNull();
    expect(telHref('7')).toBeNull();
  });
});

describe('phoneText', () => {
  it('gibt den Originaltext ohne umgebende Leerzeichen zurueck', () => {
    expect(phoneText('  0170 1234567 ')).toBe('0170 1234567');
    // Die Anzeige behaelt bewusst, was die Person eingetragen hat -- auch das,
    // was im Waehlziel wegfaellt. Sonst verschwiegen wir den Zusatz.
    expect(phoneText('0170 1234567 (ab 18 Uhr)')).toBe(
      '0170 1234567 (ab 18 Uhr)'
    );
  });

  // Weder das Profil noch das Modell schneidet die Eingabe ab. Ohne diesen
  // Riegel stuende in der Maske eine Ueberschrift "Telefon" ueber einer leeren
  // Zeile mit totem Link.
  it('liefert null fuer leere Eingaben', () => {
    expect(phoneText(null)).toBeNull();
    expect(phoneText(undefined)).toBeNull();
    expect(phoneText('   ')).toBeNull();
  });
});
