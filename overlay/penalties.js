/*
 * Laufende Strafen eines Spiels.
 *
 * Eine gemeinsame Datei fuer Buehne und Bedienfeld: Beide brauchen dieselbe
 * Liste -- die Buehne, um sie anzuzeigen, das Bedienfeld, um je Strafe einen
 * Knopf „Beendet" anzubieten. Zwei Abschriften derselben Regeln liefen
 * auseinander, und die Regie saehe im Bedienfeld etwas anderes als das
 * Publikum im Bild.
 *
 * Gerechnet wird gegen die Uhr des Bedienfelds. Eine Serveruhr gibt es nicht,
 * und die Ereigniszeiten aus dem Spielbericht sind tagesgenau ZUM ABSCHNITT:
 * Die Spieluhr faengt in jedem Drittel wieder bei 0:00 an, aufwaerts zaehlend,
 * und genau so tippt das Sekretariat sie ein.
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) {
    // Nur fuer Pruefskripte ausserhalb des Browsers. Im Browser gibt es kein
    // `module`, dort landet alles unter `window.SmPenalties`.
    module.exports = factory();
  } else {
    global.SmPenalties = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Dauer je Strafart in Millisekunden. Angezeigt wird, was ein Spieler
  // nachweislich absitzt.
  //
  // Die persoenliche Strafe ueber zehn Minuten gehoert dazu: Sie kommt nie
  // allein, sondern immer zusammen mit einer Zeitstrafe, und die steht als
  // eigenes Ereignis daneben. Die Unterzahl liest sich also weiterhin an der
  // Zwei-Minuten-Strafe ab, und die zehn Minuten sagen, wie lange der Spieler
  // noch fehlt.
  //
  // Die Matchstrafe (`penalty_ms_*`) steht nicht selbst in dieser Liste,
  // sondern laeuft als ihre Bankstrafe 2+2 mit (siehe MATCHSTRAFE).
  //
  // `penalty_5` ist im Strafenkatalog inzwischen ausgeblendet (die grosse
  // Strafe gibt es im Regelwerk nicht mehr), steht aber in aelteren Spielen
  // noch in den Daten und kostet hier nichts.
  var DAUER_MS = {
    penalty_2: 120000,
    penalty_2and2: 240000,
    penalty_5: 300000,
    penalty_10: 600000,
  };

  // Kleine Strafen enden vorzeitig, wenn die Gegenseite in Ueberzahl trifft.
  // Bei der doppelten kleinen Strafe endet dabei nur die erste Haelfte: Die
  // zweite beginnt im Augenblick des Tores und laeuft von dort zwei Minuten
  // (siehe strafenMitEnde).
  //
  // Die grosse und die persoenliche Strafe laufen dagegen in jedem Fall ab.
  // Bei den zehn Minuten faellt das auf der Tafel auf: Nach dem Ueberzahltor
  // steht dort weiter eine Zeit, obwohl die Mannschaft wieder vollzaehlig ist
  // -- denn beendet wurde die begleitende Zeitstrafe, nicht diese hier.
  var KLEINE_STRAFE = { penalty_2: true, penalty_2and2: true };

  // Matchstrafen, alle Varianten des Katalogs (Setting#penalties): Volle und
  // technische Matchstrafe sowie die ausgeblendeten Spielstrafen 1 bis 3.
  //
  // Eine Matchstrafe zieht IMMER eine Bankstrafe 2+2 nach sich, auch wenn die
  // nicht als eigenes Ereignis im Spielbericht steht. Die Mannschaft spielt
  // also ab diesem Zeitpunkt in Unterzahl, und diese Datei rechnet die
  // Matchstrafe deshalb als 2+2. Die Zeit sitzt ein ANDERER Spieler ab, und
  // wer das ist, steht in keinem Feld des Spielberichts: Die Tafel zeigt dort
  // „Team" statt der Nummer des bestraften Spielers (siehe laufende).
  //
  // Steht beim selben Team im selben Abschnitt zur selben Zeit zusaetzlich
  // eine 2+2 (oder in Altdaten eine 5), ist das genau diese Bankstrafe; dann
  // laeuft die Matchstrafe nicht ein zweites Mal mit. Je eingetragener
  // Strafe wird eine Matchstrafe aufgewogen.
  var MATCHSTRAFE = {
    penalty_ms_full: true,
    penalty_ms_tech: true,
    penalty_ms1: true,
    penalty_ms2: true,
    penalty_ms3: true,
  };
  var BANKSTRAFE = "penalty_2and2";
  var ALS_BANKSTRAFE = { penalty_2and2: true, penalty_5: true };

  // Laenge einer einzelnen kleinen Strafe. Eine doppelte besteht aus zwei
  // solchen Teilen hintereinander, und genau so wird sie unten gerechnet.
  var TEIL_MS = 120000;

  // Strafarten, die eine Mannschaft in Unterzahl bringen. Die persoenliche
  // Strafe ueber zehn Minuten gehoert NICHT dazu: Sie kommt immer mit einer
  // begleitenden Zeitstrafe, und die steht als eigenes Ereignis daneben -- sie
  // ein zweites Mal zu zaehlen ergaebe eine Unterzahl, die es nicht gibt.
  var UNTERZAHL_STRAFE = {
    penalty_2: true,
    penalty_2and2: true,
    penalty_5: true,
  };

  // Wie weit die Uhr des Bedienfelds der des Sekretariats nachlaufen darf,
  // damit eine eben eingetragene Strafe trotzdem schon erscheint.
  //
  // Eine Strafe, die spaeter beginnt als die Uhr steht, ist normalerweise genau
  // das: Das Sekretariat tippt sie in dem Augenblick ein, in dem die Regie noch
  // ein paar Sekunden hinterherhaengt, und `2:00` ist dann die richtige Angabe.
  // Bei einem groesseren Abstand stimmt die Annahme nicht mehr -- steht die Uhr
  // nach einem Zuruecksetzen auf 0:00, tauchten sonst alle Strafen des
  // Abschnitts wieder mit voller Dauer auf, obwohl sie langst abgelaufen sind.
  var MAX_VORLAUF_MS = 60000;

  // Mehr als drei Eintraege je Mannschaft passen nicht neben das Wort in der
  // Mitte, ohne die Anzeigetafel zu verbreitern. Weiter als zwei Spieler geht
  // keine Unterzahl; die dritte Zeile deckt eine wartende Strafe oder eine
  // mitlaufende persoenliche Strafe ab. Angezeigt wird, was zuerst ablaeuft,
  // die Sortierung weiter unten entscheidet das.
  var MAX_JE_SEITE = 3;

  // „12:34" -> Millisekunden. Das Sekretariat tippt die Zeit von Hand, die
  // Form ist also nicht garantiert. Eine unlesbare Zeit heisst: diese Strafe
  // nicht anzeigen -- geraten wird nichts.
  function zeitMs(text) {
    var m = /^(\d{1,3}):(\d{2})$/.exec(String(text).trim());
    if (!m) return null;
    return (Number(m[1]) * 60 + Number(m[2])) * 1000;
  }

  function andereSeite(seite) {
    return seite === "home" ? "guest" : "home";
  }

  // Abschnittsnummer eines Ereignisses als Zahl, sonst null.
  //
  // `events` ist eine JSONB-Spalte, und die Nummer steht dort mal als Zahl, mal
  // als Zeichenkette -- der Spielbericht schreibt sie ungeprueft, und
  // `overlay.js` normalisiert sie an seinen eigenen Stellen aus demselben Grund
  // (`periodValue`). Ein strenger Vergleich liess ein solches Spiel den ganzen
  // Abend ohne Strafen aussehen, und schlimmer: Stand die Nummer nur an den
  // TOREN als Zeichenkette, fiel allein die Verkuerzung durch das Ueberzahltor
  // aus, und eine beendete Strafe lief auf Sendung bis zu zwei Minuten weiter.
  function abschnittVon(wert) {
    var zahl = Number(wert);
    return isFinite(zahl) ? zahl : null;
  }

  // Der laufende Spielabschnitt als ganze Zahl, sonst null. Die Pausen stehen
  // mit halben Nummern in `period_titles` (1.5, 2.5): Dann laeuft keine Uhr,
  // und eine Restzeit waere geraten.
  function laufenderAbschnitt(game) {
    var titel = game && game.current_period_title;
    var nummer = titel && titel.period;
    if (typeof nummer !== "number") return null;
    return nummer === Math.floor(nummer) ? nummer : null;
  }

  // Alle Strafen eines Abschnitts mit ihrem tatsaechlichen Ende, Ueberzahltore
  // eingerechnet.
  //
  // Gerechnet wird als Ablauf und nicht Strafe fuer Strafe, weil die Regel die
  // Mannschaft betrifft und nicht den einzelnen Eintrag:
  //
  //   1. Eine kleine Strafe endet vorzeitig nur, wenn die Gegenseite IN
  //      UEBERZAHL trifft. Bei vier gegen vier, also einer Strafe auf jeder
  //      Seite, laeuft sie weiter -- und vier gegen vier ist kein Sonderfall,
  //      sondern Alltag.
  //   2. Ein Ueberzahltor beendet GENAU EINE Strafe, naemlich die, die als
  //      naechste ablaeuft. Bei drei gegen fuenf bleibt die zweite stehen.
  //   3. Eine doppelte kleine Strafe sind zwei Strafen hintereinander: Endet
  //      die erste beim Tor, beginnt die zweite in diesem Augenblick und laeuft
  //      von dort zwei Minuten.
  //
  // Jede dieser drei Aussagen haengt am Zustand zum Zeitpunkt des Tores, also
  // am Ergebnis der vorherigen Tore. Deshalb ein Durchlauf in zeitlicher
  // Reihenfolge, der die Enden mitfuehrt: Eine Rechnung je Strafe braeuchte die
  // Enden der anderen und liefe im Kreis.
  //
  // Nicht abgebildet: gestapelte Strafen. Ab der dritten gleichzeitigen Strafe
  // einer Mannschaft beginnt die Zeit erst, wenn eine der laufenden abgelaufen
  // ist. Die Tafel zeigt hoechstens drei Eintraege je Seite, und der Fall ist
  // selten -- angezeigt wird dann der eingetragene Beginn.
  function strafenMitEnde(events, abschnitt) {
    var strafen = [];
    var tore = [];

    // Eingetragene Bankstrafen je Team und Zeit, gegen die Matchstrafen
    // aufgewogen werden (siehe MATCHSTRAFE).
    var bankstrafen = {};
    for (var b = 0; b < events.length; b++) {
      var kandidat = events[b];
      if (abschnittVon(kandidat.period) !== abschnitt) continue;
      if (kandidat.event_type !== "penalty") continue;
      if (!ALS_BANKSTRAFE[kandidat.penalty_type]) continue;
      var zeitpunkt = zeitMs(kandidat.time);
      if (zeitpunkt === null) continue;
      var schluessel = kandidat.event_team + "|" + zeitpunkt;
      bankstrafen[schluessel] = (bankstrafen[schluessel] || 0) + 1;
    }

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      if (abschnittVon(event.period) !== abschnitt) continue;

      var zeit = zeitMs(event.time);
      if (zeit === null) continue;

      if (event.event_type === "goal") {
        tore.push({ zeit: zeit, seite: event.event_team });
        continue;
      }

      if (event.event_type !== "penalty") continue;

      var art = event.penalty_type;
      var ausMatchstrafe = !!MATCHSTRAFE[art];
      if (ausMatchstrafe) {
        var key = event.event_team + "|" + zeit;
        if (bankstrafen[key] > 0) {
          bankstrafen[key] -= 1;
          continue;
        }
        art = BANKSTRAFE;
      }

      var dauer = DAUER_MS[art];
      if (!dauer) continue;

      var teile = KLEINE_STRAFE[art]
        ? Math.max(1, Math.round(dauer / TEIL_MS))
        : 1;

      strafen.push({
        event: event,
        ausMatchstrafe: ausMatchstrafe,
        seite: event.event_team,
        start: zeit,
        dauer: dauer,
        // Nur die kleine Strafe endet vorzeitig; die grosse und die
        // persoenliche laufen in jedem Fall ab.
        kuerzbar: !!KLEINE_STRAFE[art],
        // Nur diese Arten bringen eine Mannschaft in Unterzahl.
        unterzahl: !!UNTERZAHL_STRAFE[art],
        restTeile: teile,
        teilLaenge: teile > 1 ? TEIL_MS : dauer,
        ende: zeit + dauer,
      });
    }

    tore.sort(function (a, b) {
      return a.zeit - b.zeit;
    });

    for (var t = 0; t < tore.length; t++) {
      beendeEine(strafen, tore[t]);
    }

    return strafen;
  }

  // Wirkung eines Tores auf die laufenden Strafen.
  function beendeEine(strafen, tor) {
    var bestraft = andereSeite(tor.seite);

    var laufend = strafen.filter(function (strafe) {
      return (
        strafe.unterzahl && strafe.start <= tor.zeit && tor.zeit < strafe.ende
      );
    });

    var unterzahl = laufend.filter(function (strafe) {
      return strafe.seite === bestraft;
    });
    var gegenzahl = laufend.filter(function (strafe) {
      return strafe.seite === tor.seite;
    });

    // Keine Ueberzahl, kein vorzeitiges Ende.
    if (unterzahl.length <= gegenzahl.length) return;

    var ziel = null;
    for (var i = 0; i < unterzahl.length; i++) {
      if (!unterzahl[i].kuerzbar) continue;
      if (!ziel || unterzahl[i].ende < ziel.ende) ziel = unterzahl[i];
    }
    if (!ziel) return;

    ziel.restTeile -= 1;
    ziel.ende =
      ziel.restTeile > 0
        ? tor.zeit + ziel.restTeile * ziel.teilLaenge
        : tor.zeit;
  }

  /**
   * Die gerade laufenden Strafen, die vorderste zuerst.
   *
   * `game`    Spiel aus dem Overlay-Abruf (OverlayPayload)
   * `control` Steuerzustand am Overlay-Link (Bedienfeld)
   * `clockMs` Stand der Uhr des Bedienfelds in Millisekunden
   *
   * Leer, solange keine Uhr laeuft: Ohne sie gibt es keine Bezugsgroesse, und
   * eine Restzeit waere eine Behauptung. Ebenso in den Pausen und fuer
   * Strafen aus einem frueheren Abschnitt -- wie viel davon in den neuen
   * hinueberlaeuft, liesse sich nur mit der Abschnittslaenge ausrechnen, und
   * die steht nicht in der Nutzlast.
   */
  function laufende(game, control, clockMs) {
    if (!game || typeof clockMs !== "number") return [];

    var abschnitt = laufenderAbschnitt(game);
    if (abschnitt === null) return [];

    // Als Zeichenketten vergleichen: Die Ereigniskennung kommt aus einer
    // JSONB-Spalte und ist mal Zahl, mal Zeichenkette. Ein strenger Vergleich
    // liesse den Knopf „Beendet" dann wirkungslos aussehen.
    var beendet = ((control && control.penalties_ended) || []).map(String);
    var strafen = strafenMitEnde(game.events || [], abschnitt);
    var offen = [];

    for (var i = 0; i < strafen.length; i++) {
      var strafe = strafen[i];
      var event = strafe.event;

      // Von Hand beendet: Die Regie hat gesehen, dass der Spieler wieder auf
      // dem Feld steht. Das schlaegt jede Rechnung.
      if (beendet.indexOf(String(event.event_id)) !== -1) continue;

      // Beginnt spaeter als die Uhr steht, und das um mehr als einen
      // Uhrversatz: nicht anzeigen (siehe MAX_VORLAUF_MS).
      if (strafe.start - clockMs > MAX_VORLAUF_MS) continue;

      var rest = strafe.ende - clockMs;
      if (rest <= 0) continue;

      offen.push({
        event_id: event.event_id,
        side: event.event_team,
        // Bei einer Matchstrafe sitzt ein anderer die Zeit ab: keine Nummer,
        // nummerText macht daraus „Team".
        number: strafe.ausMatchstrafe ? null : event.number,
        name: strafe.ausMatchstrafe ? null : event.scorer_name || null,
        penalty_type: event.penalty_type,
        // Gedeckelt: Geht die Uhr des Bedienfelds der des Sekretariats
        // nach, stuende hier sonst mehr als die Strafe ueberhaupt dauert.
        remaining_ms: Math.min(strafe.dauer, rest),
      });
    }

    offen.sort(function (a, b) {
      return a.remaining_ms - b.remaining_ms;
    });

    var jeSeite = { home: 0, guest: 0 };
    return offen.filter(function (eintrag) {
      if (eintrag.side !== "home" && eintrag.side !== "guest") return false;
      jeSeite[eintrag.side] += 1;
      return jeSeite[eintrag.side] <= MAX_JE_SEITE;
    });
  }

  // Trikotnummer, sonst „Team". Die Pseudo-Nummern des Spielberichts (1000,
  // 2000) stehen ANSTELLE eines Spielers, und eine Mannschaftsstrafe hat
  // niemanden auf dem Feld, dem sie gehoert: Eine Nummer, die zu keinem
  // Spieler passt, waere auf Sendung eine Behauptung ueber einen bestimmten
  // Menschen.
  function nummerText(eintrag) {
    var nummer = Number(eintrag && eintrag.number);
    if (nummer > 0 && nummer < 1000) return "#" + nummer;
    return "Team";
  }

  // Restzeit als m:ss. AUFGERUNDET, wie jede Strafuhr in der Halle: Solange
  // noch eine Sekunde laeuft, steht dort 0:01 und nicht 0:00.
  function restText(ms) {
    var gesamt = Math.ceil(Math.max(0, ms) / 1000);
    var minuten = Math.floor(gesamt / 60);
    var sekunden = gesamt % 60;
    return minuten + ":" + (sekunden < 10 ? "0" : "") + sekunden;
  }

  return {
    laufende: laufende,
    nummerText: nummerText,
    restText: restText,
    DAUER_MS: DAUER_MS,
  };
});
