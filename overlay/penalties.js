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
  // NICHT dabei ist die Matchstrafe (`penalty_ms_*`): Der bestrafte Spieler
  // ist fuer den Rest der Partie draussen, die Zeit sitzt ein ANDERER ab --
  // und wer das ist, steht in keinem Feld des Spielberichts. Die Tafel wuerde
  // eine Nummer nennen, die gar nicht auf der Strafbank sitzt.
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

  // Kleine Strafen enden vorzeitig, wenn die Mannschaft in Ueberzahl trifft.
  // Bei der doppelten kleinen Strafe endet dabei nur die erste Haelfte, die
  // zweite laeuft weiter -- deshalb wird je Tor um zwei Minuten gekuerzt und
  // nicht auf null gesetzt.
  //
  // Die grosse und die persoenliche Strafe laufen dagegen in jedem Fall ab.
  // Bei den zehn Minuten faellt das auf der Tafel auf: Nach dem Ueberzahltor
  // steht dort weiter eine Zeit, obwohl die Mannschaft wieder vollzaehlig ist
  // -- denn beendet wurde die begleitende Zeitstrafe, nicht diese hier.
  var KLEINE_STRAFE = { penalty_2: true, penalty_2and2: true };
  var KUERZUNG_MS = 120000;

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

  // Der laufende Spielabschnitt als ganze Zahl, sonst null. Die Pausen stehen
  // mit halben Nummern in `period_titles` (1.5, 2.5): Dann laeuft keine Uhr,
  // und eine Restzeit waere geraten.
  function laufenderAbschnitt(game) {
    var titel = game && game.current_period_title;
    var nummer = titel && titel.period;
    if (typeof nummer !== "number") return null;
    return nummer === Math.floor(nummer) ? nummer : null;
  }

  // Tore der Gegenseite in diesem Abschnitt, aufsteigend nach Zeit.
  function gegentore(events, seite, abschnitt) {
    var gegen = andereSeite(seite);

    return events
      .filter(function (event) {
        return (
          event.event_type === "goal" &&
          event.event_team === gegen &&
          event.period === abschnitt &&
          zeitMs(event.time) !== null
        );
      })
      .map(function (event) {
        return zeitMs(event.time);
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  // Ende der Strafe in Spielzeit, Tore der Gegenseite eingerechnet.
  function endeMs(event, start, dauer, events, abschnitt) {
    var ende = start + dauer;
    if (!KLEINE_STRAFE[event.penalty_type]) return ende;

    var tore = gegentore(events, event.event_team, abschnitt);

    for (var i = 0; i < tore.length; i++) {
      // Vor der Strafe gefallen: geht sie nichts an.
      if (tore[i] <= start) continue;
      // Nach dem (bereits gekuerzten) Ende: Die Strafe war da schon vorbei,
      // und alles Weitere erst recht.
      if (tore[i] >= ende) break;

      ende = Math.max(start, ende - KUERZUNG_MS);
    }

    return ende;
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
    var events = game.events || [];
    var offen = [];

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      if (event.event_type !== "penalty") continue;
      if (event.period !== abschnitt) continue;

      var dauer = DAUER_MS[event.penalty_type];
      if (!dauer) continue;

      // Von Hand beendet: Die Regie hat gesehen, dass der Spieler wieder auf
      // dem Feld steht. Das schlaegt jede Rechnung.
      if (beendet.indexOf(String(event.event_id)) !== -1) continue;

      var start = zeitMs(event.time);
      if (start === null) continue;

      var ende = endeMs(event, start, dauer, events, abschnitt);
      var rest = ende - clockMs;
      if (rest <= 0) continue;

      offen.push({
        event_id: event.event_id,
        side: event.event_team,
        number: event.number,
        name: event.scorer_name || null,
        penalty_type: event.penalty_type,
        // Gedeckelt: Geht die Uhr des Bedienfelds der des Sekretariats
        // nach, stuende hier sonst mehr als die Strafe ueberhaupt dauert.
        remaining_ms: Math.min(dauer, rest),
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
