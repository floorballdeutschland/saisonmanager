/*
 * Datenanbindung der Broadcast-Overlays.
 *
 * Holt im Sekundentakt Steuerzustand und Spieldaten von
 * /api/v2/public/overlay/live und schreibt sie in die Bühne. Kein Framework:
 * Die Seite hat ein Dutzend Felder, und sie muss vor allem eines sein, nämlich
 * robust. Sie läuft stundenlang unbeaufsichtigt in einer Halle.
 *
 * Grundregel für alles hier: Bei einem Fehler bleibt stehen, was zuletzt
 * richtig war. Ein leeres Overlay mitten in der Übertragung ist schlimmer als
 * eine Anzeige, die ein paar Sekunden alt ist.
 */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var token = params.get("token");
  var gameId = params.get("game_id");
  var debug = params.get("debug") === "1";
  // Vollbild statt Bühne. Beides zugleich gibt es nicht: Ein Vollbild ist eine
  // eigene OBS-Szene und ersetzt das Kamerabild, die Bühne liegt darin.
  var onlyFullscreen = params.get("only") === "fullscreen";
  var scene = params.get("scene") || "";

  // Der Poll-Takt bestimmt, wie schnell ein Tor auf Sendung geht. Eine Sekunde
  // ist mit dem Versionsabgleich (siehe `v` unten) günstig: Ohne Änderung am
  // Spiel antwortet der Server mit ein paar hundert Byte.
  var POLL_MS = 1000;
  // Vollbilder stehen still; sie brauchen den Sekundentakt nicht.
  var FULLSCREEN_POLL_MS = 5000;
  // Nach einem Fehler langsamer nachfragen, damit ein Ausfall die API nicht
  // zusätzlich belastet. Steigt bis ERROR_BACKOFF_MAX_MS.
  var ERROR_BACKOFF_START_MS = 2000;
  var ERROR_BACKOFF_MAX_MS = 30000;
  // Ein Abruf, der nie zurueckkommt, plant auch keinen naechsten ein. Genau das
  // passiert nach einem WLAN-Wechsel in der Halle: Die Verbindung bleibt halb
  // offen, fetch wartet ewig, und das Overlay friert fuer den Rest der
  // Uebertragung ein. Deshalb harte Frist statt Vertrauen.
  var REQUEST_TIMEOUT_MS = 4000;
  // Ab wann die Anzeige zugibt, dass sie nichts Neues mehr weiss. Der Live-Punkt
  // geht dann aus, statt einen alten Stand als aktuell auszugeben.
  var STALE_AFTER_MS = 20000;

  var state = {
    lastVersion: null, // game.updated_at der zuletzt geholten Spieldaten
    game: null, // zuletzt erfolgreich geholte Spieldaten
    control: {}, // Steuerzustand aus dem Dock
    errorDelay: ERROR_BACKOFF_START_MS,
    lastOkAt: null,
    // Abweichung der lokalen Rechneruhr von der Serverzeit, in Millisekunden.
    // Ohne diesen Ausgleich zeigt ein Regie-Laptop mit verstellter Uhr eine
    // falsche Spielzeit. Gleitend gemittelt, damit ein einzelner langsamer
    // Abruf die Uhr nicht springen lässt.
    clockOffset: null,
    // Endgueltig abgewiesen (kein oder abgelaufenes Token). Dann hoert das
    // Nachfragen auf.
    terminal: false,
    // Antwort des ligaweiten Abrufs (Tabelle, Torschuetzen oder Spielplan),
    // je nach Szene. Nur im Vollbild belegt.
    league: null,
  };

  var el = {
    stage: document.getElementById("stage"),
    scoreboard: document.getElementById("scoreboard"),
    homeName: document.getElementById("home-name"),
    guestName: document.getElementById("guest-name"),
    homeLogo: document.getElementById("home-logo"),
    guestLogo: document.getElementById("guest-logo"),
    homeGoals: document.getElementById("home-goals"),
    guestGoals: document.getElementById("guest-goals"),
    period: document.getElementById("period"),
    clock: document.getElementById("clock"),
    live: document.getElementById("live"),
    liveLabel: document.getElementById("live-label"),
    lowerThird: document.getElementById("lower-third"),
    ltKicker: document.getElementById("lt-kicker"),
    ltMain: document.getElementById("lt-main"),
    ltSub: document.getElementById("lt-sub"),
    fullscreen: document.getElementById("fullscreen"),
    fsLeague: document.getElementById("fs-league"),
    fsTitle: document.getElementById("fs-title"),
    fsSub: document.getElementById("fs-sub"),
    fsBody: document.getElementById("fs-body"),
    fsNote: document.getElementById("fs-note"),
    debug: document.getElementById("debug"),
  };

  var scale = parseFloat(params.get("scale"));
  if (scale > 0) {
    el.stage.style.setProperty("--ov-scale", String(scale));
  }

  if (debug) {
    el.debug.classList.remove("ov-hidden");
  }

  if (!token) {
    showDebug(
      "Kein Token in der URL. Der Link stammt aus dem Spielbericht.",
      true
    );
    return;
  }

  function showDebug(text, isError) {
    if (!debug) return;

    el.debug.textContent = text;
    el.debug.classList.toggle("ov-debug--error", Boolean(isError));
  }

  // Der Sekundentakt gilt der Anzeigetafel: Ein Tor soll sofort auf Sendung
  // gehen. Ein Vollbild steht still, dort genügt ein ruhigerer Takt — und in
  // einer Halle laufen davon gleich mehrere Browser-Quellen nebeneinander.
  function pollInterval() {
    return onlyFullscreen ? FULLSCREEN_POLL_MS : POLL_MS;
  }

  function buildUrl() {
    var url = "/api/v2/public/overlay/live?token=" + encodeURIComponent(token);
    if (gameId) url += "&game_id=" + encodeURIComponent(gameId);
    // Bekannter Stand: Der Server lässt die Spieldaten dann weg.
    if (state.lastVersion !== null)
      url += "&v=" + encodeURIComponent(state.lastVersion);
    return url;
  }

  function poll() {
    var controller =
      typeof AbortController === "function" ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, REQUEST_TIMEOUT_MS);

    fetch(buildUrl(), {
      credentials: "omit",
      cache: "no-store",
      signal: controller ? controller.signal : undefined,
    })
      .then(function (response) {
        window.clearTimeout(timer);
        // 400 und 410 sind endgueltig: kein Token, abgelaufen oder
        // zurueckgezogen. Weiter zu fragen bringt nichts, und die Anzeige darf
        // den alten Stand nicht als aktuell stehen lassen.
        if (response.status === 400 || response.status === 410) {
          state.terminal = true;
          throw new Error("HTTP " + response.status);
        }
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (body) {
        apply(body);
        state.errorDelay = ERROR_BACKOFF_START_MS;
        state.lastOkAt = Date.now();
        showDebug(debugText(), false);
        window.setTimeout(poll, pollInterval());
      })
      .catch(function (error) {
        window.clearTimeout(timer);
        // Bewusst nichts zurücksetzen: Die Anzeige behält ihren letzten Stand.
        showDebug("Kein Abruf: " + error.message + "\n" + debugText(), true);
        if (state.terminal) return;

        window.setTimeout(poll, state.errorDelay);
        state.errorDelay = Math.min(state.errorDelay * 2, ERROR_BACKOFF_MAX_MS);
      });
  }

  function apply(body) {
    state.control = body.state || {};
    trackClockOffset(body.server_time);

    if (body.game) {
      state.game = body.game;
      renderGame(state.game);
      // Die Version erst NACH dem Aufbau merken. Stand sie vorher, war ein
      // Aufbaufehler nicht mehr behebbar: Der Server lässt den Spielblock bei
      // bekannter Version weg, der nächste Abruf brachte also keine Daten zum
      // erneuten Versuch mit, und dieselbe Ausnahme fiel wieder. Bis zum Neuladen
      // der Quelle blieb es schwarz. Merken wir sie erst danach, holt der nächste
      // Abruf die vollen Daten und der Versuch kann gelingen.
      state.lastVersion = body.game_version;
    } else if (body.game_version !== state.lastVersion) {
      // Der Spielblock fehlt normalerweise, weil sich nichts geändert hat.
      // Weicht die Version trotzdem ab, hat das Dock ein anderes Spiel
      // gewählt: Version vergessen, damit der nächste Abruf die vollen Daten
      // bringt.
      state.lastVersion = null;
    }

    renderControl();
    renderFullscreen();
  }

  function renderGame(game) {
    setTeam("home", game.home);
    setTeam("guest", game.guest);

    renderScore(game);

    var period = game.current_period_title || {};
    el.period.textContent = period.title || "";

    renderLiveState(game);
  }

  // Der Live-Punkt behauptet, die Anzeige sei aktuell. Kommt seit einer Weile
  // nichts mehr durch (totes Token, Netz weg), waere das eine Falschaussage:
  // Dann geht der Punkt aus, und der Regie faellt es auf.
  function renderLiveState(game) {
    game = game || state.game;
    if (!game) return;

    var fresh =
      !state.terminal &&
      state.lastOkAt !== null &&
      Date.now() - state.lastOkAt < STALE_AFTER_MS;
    var running = Boolean(game.started) && !game.ended;

    el.live.classList.toggle("ov-live--idle", !running || !fresh);
    el.liveLabel.textContent = !fresh
      ? "Pause"
      : game.ended
        ? "Ende"
        : running
          ? "Live"
          : "Gleich";
  }

  // Der Spielstand kommt aus dem Spielbericht, es sei denn, das Dock hat ihn
  // ausdrücklich übersteuert. Das ist der Notausgang, wenn das Sekretariat
  // hinterherhinkt; er bleibt aktiv, bis er im Dock zurückgesetzt wird, und
  // ist dort deutlich als aktiv gekennzeichnet.
  function renderScore(game) {
    var override = state.control.score_override;
    var result = (game && game.result) || {};
    var home = override ? override.home_goals : result.home_goals;
    var guest = override ? override.guest_goals : result.guest_goals;

    el.homeGoals.textContent = numberOr(home, 0);
    el.guestGoals.textContent = numberOr(guest, 0);
  }

  function setTeam(side, team) {
    team = team || {};
    (side === "home" ? el.homeName : el.guestName).textContent =
      team.short_name || team.name || "";

    var chip = side === "home" ? el.homeLogo : el.guestLogo;
    var logo = team.logo_small || team.logo;

    if (!logo) {
      hideChip(chip);
      return;
    }

    // Nur neu setzen, wenn sich die Quelle geändert hat: Ein erneutes Zuweisen
    // derselben URL lässt das Bild in CEF kurz flackern.
    var img = chip.querySelector("img");
    if (img && img.getAttribute("src") === logo) return;

    chip.classList.remove("ov-hidden");
    chip.innerHTML = "";
    img = document.createElement("img");
    // Lädt das Logo nicht (Datei fehlt, Netz weg), verschwindet der Chip, statt
    // dass ein kaputtes Bildsymbol auf Sendung geht.
    img.addEventListener("error", function () {
      hideChip(chip);
    });
    img.src = logo;
    img.alt = "";
    chip.appendChild(img);
  }

  // Ohne brauchbares Logo bleibt der Mannschaftsname allein stehen. Ein
  // Platzhalter mit dem Kürzel wäre hier keine Hilfe, sondern stünde als
  // zweite, kleinere Fassung direkt neben dem Namen.
  function hideChip(chip) {
    chip.classList.add("ov-hidden");
    chip.innerHTML = "";
  }

  function renderControl() {
    // Ohne geöffnetes Dock gibt es keinen Steuerzustand. Dann zeigt die Bühne
    // die Anzeigetafel, sobald Spieldaten da sind: Ein Verein, der nur die
    // Browser-Quelle einbindet, soll etwas sehen.
    var visible =
      state.control.scoreboard_visible === undefined
        ? Boolean(state.game)
        : Boolean(state.control.scoreboard_visible);

    el.scoreboard.classList.toggle("ov-hidden", !visible);
    // Auch ohne neue Spieldaten: Die Übersteuerung steckt allein im
    // Steuerzustand, sonst wirkte ein Druck im Dock erst beim nächsten
    // Eintrag im Spielbericht.
    if (state.game) renderScore(state.game);
    renderLowerThird();
  }

  // ── Uhr ─────────────────────────────────────────────────────────────────
  // Es gibt keine Serveruhr. Das Dock setzt sie, hier wird nur angezeigt.

  function trackClockOffset(serverTime) {
    if (typeof serverTime !== "number") return;

    var sample = serverTime - Date.now();
    // Erster Wert direkt übernehmen, danach gleitend mitteln: Ein einzelner
    // langsamer Abruf soll die Anzeige nicht springen lassen.
    state.clockOffset =
      state.clockOffset === null
        ? sample
        : state.clockOffset * 0.8 + sample * 0.2;
  }

  function serverNow() {
    return Date.now() + (state.clockOffset || 0);
  }

  // Wird bei JEDEM Tick neu aus dem Ankerzeitpunkt gerechnet, nie
  // hochgezählt: OBS drosselt versteckte Quellen, ein Zähler liefe weg.
  function renderClock() {
    var clock = state.control.clock;

    if (!clock || clock.visible === false) {
      el.clock.classList.add("ov-hidden");
      return;
    }

    var anchored = typeof clock.anchor_ms === "number";
    var elapsed = Number(clock.elapsed_ms) || 0;
    if (clock.running && anchored) {
      elapsed += Math.max(0, serverNow() - Number(clock.anchor_ms));
    }

    el.clock.classList.remove("ov-hidden");
    // „läuft" ohne Anker wäre eine stehende Uhr, die sich als laufend gibt.
    el.clock.classList.toggle("ov-clock--stopped", !clock.running || !anchored);
    el.clock.textContent = formatClock(elapsed);
  }

  function formatClock(ms) {
    var total = Math.floor(Math.max(0, ms) / 1000);
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  // ── Bauchbinde ──────────────────────────────────────────────────────────

  function renderLowerThird() {
    var lt = state.control.lower_third;
    var content = lt && lt.kind ? lowerThirdContent(lt) : null;

    if (!content) {
      el.lowerThird.classList.add("ov-lt-hidden");
      return;
    }

    // textContent, nicht innerHTML: Namen und Freitext kommen aus der
    // Datenbank beziehungsweise aus dem Dock.
    el.ltKicker.textContent = content.kicker || "";
    el.ltMain.textContent = content.main || "";
    el.ltSub.textContent = content.sub || "";
    el.ltSub.classList.toggle("ov-hidden", !content.sub);
    el.lowerThird.classList.remove("ov-lt-hidden");
  }

  function lowerThirdContent(lt) {
    switch (lt.kind) {
      case "goal":
        return goalContent(lt);
      case "penalty":
        return penaltyContent(lt);
      case "text":
        // Freitext aus dem Dock, etwa für Kommentatorin oder Gast.
        return lt.main
          ? { kicker: lt.kicker || "", main: lt.main, sub: lt.sub || "" }
          : null;
      case "venue":
        return venueContent();
      default:
        return null;
    }
  }

  function goalContent(lt) {
    // Kein Ausweichen auf das zuletzt gefallene Tor: Ist das gemeinte Ereignis
    // weg (nachträglich geändert oder gelöscht), ginge sonst ein anderes,
    // plausibel aussehendes Tor auf Sendung. Lieber gar keine Bauchbinde.
    var event = findEvent(lt.event_id);
    if (!event) return null;

    var team = teamName(event.event_team);
    var assist = event.assist_name ? "Vorlage: " + event.assist_name : "";
    // Ohne auflösbaren Schützen steht das Label aus dem Spielbericht da
    // (Eigentor, nicht angegeben), sonst bliebe die Zeile leer.
    var scorer = event.scorer_name || event.goal_type_string || "Tor";

    return {
      kicker: "Tor " + (team ? team : ""),
      main: scorer,
      sub: [assist, scoreAt(event)].filter(Boolean).join("   ·   "),
    };
  }

  function penaltyContent(lt) {
    var event = findEvent(lt.event_id);
    if (!event) return null;

    var team = teamName(event.event_team);
    return {
      kicker: "Strafe " + (team ? team : ""),
      main: event.scorer_name || "Mannschaftsstrafe",
      sub: [event.penalty_type_string, event.penalty_reason_string]
        .filter(Boolean)
        .join("   ·   "),
    };
  }

  function venueContent() {
    if (!state.game) return null;

    var league = state.game.league || {};
    var arena = state.game.arena || {};
    var home = teamLabel(state.game.home);
    var guest = teamLabel(state.game.guest);
    if (!home && !guest) return null;

    return {
      kicker: league.name || "",
      main: home + " gegen " + guest,
      sub: arena.name || "",
    };
  }

  function findEvent(eventId) {
    if (!state.game || !state.game.events || eventId === undefined) return null;

    for (var i = 0; i < state.game.events.length; i++) {
      if (state.game.events[i].event_id === eventId)
        return state.game.events[i];
    }
    return null;
  }

  function teamName(side) {
    if (!state.game || !side) return "";
    return teamLabel(side === "home" ? state.game.home : state.game.guest);
  }

  // Ohne Mannschaft bleibt es leer statt „null": OverlayPayload liefert das
  // Objekt auch für ein noch nicht gesetztes Team.
  function teamLabel(team) {
    return (team && (team.short_name || team.name)) || "";
  }

  function scoreAt(event) {
    if (typeof event.home_goals !== "number") return "";
    return event.home_goals + ":" + event.guest_goals;
  }

  function numberOr(value, fallback) {
    return typeof value === "number" ? value : fallback;
  }

  // Meldet ein Problem so, dass es hinterher noch auffindbar ist.
  //
  // `showDebug` allein genügt dafür nicht: Es schreibt in eine Fläche, die es nur
  // mit `debug=1` gibt, und die Fläche ist weg, sobald die Quelle neu lädt. Ruft
  // der Produzent später an, dass "die Tabelle im zweiten Drittel leer war", gibt
  // es dann keinen einzigen Anhaltspunkt: Diese Seite liegt außerhalb der
  // Angular-Anwendung, Sentry sieht sie also nicht, und `console` wurde hier
  // bisher nirgends benutzt. Die OBS-Protokolldatei hält die Zeile fest.
  function logProblem(message) {
    if (window.console && window.console.warn) {
      window.console.warn("[overlay] " + message);
    }
    showDebug(message, true);
  }

  function debugText() {
    var age = state.lastOkAt
      ? Math.round((Date.now() - state.lastOkAt) / 1000)
      : null;
    return [
      "Spiel: " + (state.game ? state.game.id : "noch keins"),
      "Stand: " + (state.game ? state.game.result_string || "0:0" : "-"),
      "letzter Abruf: " + (age === null ? "noch keiner" : "vor " + age + " s"),
    ].join("\n");
  }

  // ── Vollbilder ──────────────────────────────────────────────────────────
  //
  // Jedes Vollbild ist eine eigene OBS-Szene mit derselben Seite und einem
  // anderen `scene`. Die Namen sind Teil der Schnittstelle: Die
  // Szenensammlung, die der Spielbericht zum Herunterladen anbietet, setzt
  // genau diese Werte ein. Wer hier umbenennt, macht jede bereits verteilte
  // Sammlung kaputt.
  //
  // `source` benennt den ligaweiten Abruf, den die Szene braucht (oder null,
  // wenn die Spieldaten des laufenden Abrufs reichen).
  var FS_SCENES = {
    startbild: { source: null, render: fsStartbild },
    "aufstellung-heim": { source: null, render: fsLineupHome },
    "aufstellung-gast": { source: null, render: fsLineupGuest },
    drittelpause: { source: null, render: fsIntermission },
    endstand: { source: null, render: fsFinal },
    tabelle: { source: "table", render: fsTable },
    topscorer: { source: "scorer", render: fsScorer },
    "naechste-spiele": { source: "schedule", render: fsSchedule },
  };

  // Tabelle und Torschützenliste ändern sich nur, wenn ein Spiel endet. Der
  // Server hält sie 30 s vor, schneller zu fragen bringt also nichts.
  var LEAGUE_POLL_MS = 30000;
  var LEAGUE_ERROR_MS = 10000;

  // Stufen, mit denen ein zu hoher Inhalt enger gesetzt wird. Gemessen statt
  // geraten: Eine Tabelle hat je nach Liga zehn bis zwanzig Zeilen, und eine
  // Aufstellung mal zwölf und mal zweiundzwanzig Namen. Was oben abgeschnitten
  // wird, fällt in der Regie nicht auf, steht aber auf Sendung.
  var FS_DENSITY = ["", "ov-fs-dense", "ov-fs-denser", "ov-fs-densest"];
  // Eine Torschützenliste ist eine Bestenliste, keine Gesamtaufstellung. Zehn
  // Namen sind die übliche Länge; mehr wäre nicht abgeschnitten, sondern eine
  // andere Grafik.
  var FS_SCORER_LIMIT = 10;

  var PENALTY_MINUTES = {
    penalty_2: 2,
    penalty_2and2: 4,
    penalty_5: 5,
    penalty_10: 10,
  };

  // Die Matchstrafen ausdrücklich benennen, statt "alles außer Zeitstrafe" als
  // Matchstrafe zu zählen. `Game#penalty_mapping` liefert nichts, wenn der
  // Strafcode nicht im Katalog steht oder sein Eintrag kein `mapping` hat -- beides
  // gibt es im Bestand. Ein unbekannter Wert landete damit im else-Zweig, und die
  // Drittelpause behauptete eine Matchstrafe, die es nicht gab. Nachgestellt: eine
  // 2-Minuten-Strafe plus eine ohne Zuordnung ergab "2 Strafminuten · 1
  // Matchstrafe". Eine falsche Aussage über eine Mannschaft ist schlimmer als eine
  // fehlende Zahl.
  var PENALTY_MATCH_TYPES = {
    penalty_ms1: true,
    penalty_ms2: true,
    penalty_ms3: true,
    penalty_ms_tech: true,
    penalty_ms_full: true,
  };

  function fsDefinition() {
    return Object.prototype.hasOwnProperty.call(FS_SCENES, scene)
      ? FS_SCENES[scene]
      : null;
  }

  // Baut das Vollbild neu auf. Bewusst kein Diffing: Die Seite wird bei jedem
  // Szenenwechsel frisch geladen (OBS schaltet die Quelle beim Ausblenden ab),
  // und ein Bild, das einmal steht, ändert sich höchstens alle 30 Sekunden.
  function renderFullscreen() {
    if (!onlyFullscreen) return;

    var def = fsDefinition();
    if (!def) {
      // Vorher stumm. Ein Tippfehler im `scene`-Wert einer verteilten
      // OBS-Sammlung ergab damit eine Quelle, die nie etwas malt -- und selbst
      // mit `debug=1` kein Wort dazu sagte. Die Regie schneidet dann auf Schwarz.
      logProblem(
        "Unbekannte Szene: " +
          (scene || "(leer)") +
          ". Erlaubt: " +
          Object.keys(FS_SCENES).join(", ")
      );
      return;
    }

    // Ein Fehler im Aufbau darf nicht als Abrufproblem durchgehen und das Bild
    // nicht dauerhaft schwarz lassen. Ohne dieses try flog eine Ausnahme aus
    // `apply()` in den poll-catch, dort stand dann "Kein Abruf: TypeError..." --
    // die Regie liest ein Netzproblem. Und sie war nicht behebbar: `apply` merkt
    // sich die Version VOR dem Aufbau, der naechste Abruf liefert den Spielblock
    // deshalb nicht mehr mit, und derselbe Aufbau warf erneut. Bis zum Neuladen
    // der Quelle blieb es schwarz. Die Grundregel dieser Datei ist "stehen lassen,
    // was zuletzt richtig war" -- genau die galt hier nicht.
    var content;
    try {
      content = def.render();
    } catch (error) {
      logProblem("Vollbild " + scene + " nicht aufgebaut: " + error.message);
      return;
    }
    // Solange die Daten fehlen, bleibt das Vollbild unsichtbar. Ein leeres
    // Gerüst mit Überschrift und ohne Inhalt sähe auf Sendung nach Fehler aus,
    // und der Schnitt kommt ohnehin erst, wenn die Regie umschaltet.
    if (!content) return;

    el.fsLeague.textContent = content.league || "";
    el.fsTitle.textContent = content.title || "";
    el.fsSub.textContent = content.sub || "";

    el.fsBody.innerHTML = "";
    if (content.body) el.fsBody.appendChild(content.body);

    el.fsNote.textContent = content.note || "";
    el.fsNote.classList.toggle("ov-hidden", !content.note);

    el.fullscreen.classList.remove("ov-fs-hidden");
    fitBody(content.center ? "ov-fs-body ov-fs-body--center" : "ov-fs-body");
  }

  // Setzt den Inhalt so weit enger, bis er in die Fläche passt. Der Bereich
  // schneidet ab (`overflow: hidden`), und was abgeschnitten ist, sieht in der
  // Regie nach einer vollständigen Tabelle aus. Deshalb messen statt schätzen:
  // Die Anzahl der Zeilen sagt nichts über ihre Höhe, sobald Logos, lange
  // Mannschaftsnamen oder ein zweizeiliger Titel dazukommen.
  function fitBody(baseClass) {
    for (var i = 0; i < FS_DENSITY.length; i++) {
      el.fsBody.className =
        baseClass + (FS_DENSITY[i] ? " " + FS_DENSITY[i] : "");
      // Breite mitpruefen, nicht nur Hoehe: Waagerechtes Ueberlaufen schnitt
      // vorher lautlos ab, ohne eine Dichtestufe auszuloesen und ohne Hinweis.
      if (
        el.fsBody.scrollHeight <= el.fsBody.clientHeight &&
        el.fsBody.scrollWidth <= el.fsBody.clientWidth
      ) {
        return;
      }
    }
    // Auch die engste Stufe reicht nicht. Dann steht die letzte, dichteste
    // Fassung — mehr als abschneiden lässt sich hier nicht mehr tun, und die
    // Statusfläche sagt es beim Einrichten.
    // Auch als Logzeile, nicht nur in der Statusfläche: Genau der Fall, den die
    // Dichtestufen verhindern sollen, lief sonst ohne jede Spur -- eine
    // abgeschnittene Tabelle sieht auf Sendung vollständig aus.
    logProblem("Vollbild " + scene + " zu voll für die Fläche");
  }

  // Der ligaweite Abruf. Läuft getrennt vom Spiel-Abruf und in eigenem Takt.
  function pollLeague() {
    var def = fsDefinition();
    if (!def || !def.source || state.terminal) return;

    var controller =
      typeof AbortController === "function" ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, REQUEST_TIMEOUT_MS);

    fetch(
      "/api/v2/public/overlay/" +
        def.source +
        "?token=" +
        encodeURIComponent(token),
      {
        credentials: "omit",
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      }
    )
      .then(function (response) {
        window.clearTimeout(timer);
        if (response.status === 400 || response.status === 410) {
          state.terminal = true;
          throw new Error("HTTP " + response.status);
        }
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (body) {
        state.league = body;
        renderFullscreen();
        window.setTimeout(pollLeague, LEAGUE_POLL_MS);
      })
      .catch(function (error) {
        window.clearTimeout(timer);
        // Wie beim Spiel-Abruf: stehen lassen, was zuletzt richtig war -- aber
        // nicht schweigend. Vorher war das der stillste Block der Seite: kein
        // Fehler gebunden, keine Meldung. Beim Einrichten meldete die
        // Statusfläche einen gesunden Spiel-Abruf, während der Liga-Abruf bei
        // jedem Versuch scheiterte und das Vollbild leer blieb -- ohne ein
        // einziges Zeichen. Fängt außerdem einen JSON-Parsefehler mit, also eine
        // HTML-Fehlerseite statt der erwarteten Antwort.
        logProblem("Kein Liga-Abruf (" + scene + "): " + error.message);
        if (state.terminal) return;
        window.setTimeout(pollLeague, LEAGUE_ERROR_MS);
      });
  }

  // ── Bausteine ───────────────────────────────────────────────────────────

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    // textContent, nie innerHTML: Mannschafts- und Personennamen kommen aus
    // der Datenbank.
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function fragment(children) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < children.length; i++) {
      if (children[i]) frag.appendChild(children[i]);
    }
    return frag;
  }

  function crest(logo, size) {
    var box = node("div", size === "small" ? "ov-fs-cell-logo" : "ov-fs-crest");
    if (!logo) {
      box.classList.add("ov-hidden");
      return box;
    }

    var img = document.createElement("img");
    // Lädt das Logo nicht, verschwindet der Kasten, statt dass ein kaputtes
    // Bildsymbol auf Sendung geht.
    img.addEventListener("error", function () {
      box.classList.add("ov-hidden");
      box.innerHTML = "";
    });
    img.src = logo;
    img.alt = "";
    box.appendChild(img);
    return box;
  }

  // Paarung mit Logos und einer Mitte: „gegen" beim Startbild, der Endstand
  // beim Schlussbild.
  function matchGrid(middle, middleSmall) {
    var game = state.game;
    var grid = node("div", "ov-fs-match");

    grid.appendChild(matchSide(game.home));
    grid.appendChild(
      node(
        "div",
        middleSmall ? "ov-fs-versus ov-fs-versus--small" : "ov-fs-versus",
        middle
      )
    );
    grid.appendChild(matchSide(game.guest));
    return grid;
  }

  function matchSide(team) {
    team = team || {};
    var box = node("div", "ov-fs-side");
    box.appendChild(crest(team.logo || team.logo_small));
    box.appendChild(
      node("div", "ov-fs-side-name", team.name || team.short_name || "")
    );
    return box;
  }

  function factRow(facts) {
    var row = node("div", "ov-fs-facts");
    for (var i = 0; i < facts.length; i++) {
      if (!facts[i].value) continue;

      var box = node("div", "ov-fs-fact");
      box.appendChild(node("span", "ov-fs-fact-label", facts[i].label));
      box.appendChild(node("span", "ov-fs-fact-value", facts[i].value));
      row.appendChild(box);
    }
    return row.childNodes.length ? row : null;
  }

  // Tabelle mit Kopfzeile. `columns` beschreibt jede Spalte einmal, `rows`
  // liefert die Werte.
  function dataTable(columns, rows, extraClass) {
    var table = node(
      "table",
      extraClass ? "ov-fs-table " + extraClass : "ov-fs-table"
    );

    var head = node("tr");
    for (var c = 0; c < columns.length; c++) {
      head.appendChild(
        node("th", columns[c].numeric ? "ov-fs-num" : null, columns[c].label)
      );
    }
    var thead = node("thead");
    thead.appendChild(head);
    table.appendChild(thead);

    var body = node("tbody");
    for (var r = 0; r < rows.length; r++) {
      var tr = node("tr", rows[r].own ? "ov-fs-own" : null);
      for (var i = 0; i < columns.length; i++) {
        var value = rows[r].cells[i];
        var td = node("td");
        if (columns[i].numeric) td.classList.add("ov-fs-num");
        if (columns[i].strong) td.classList.add("ov-fs-strong");
        if (value instanceof Node) {
          td.appendChild(value);
        } else {
          td.textContent = value === undefined || value === null ? "" : value;
        }
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    table.appendChild(body);
    return table;
  }

  function teamCell(name, logo) {
    var cell = node("div", "ov-fs-cell-team");
    cell.appendChild(crest(logo, "small"));
    cell.appendChild(node("span", null, name || ""));
    return cell;
  }

  function leagueName() {
    var league = (state.league && state.league.league) || {};
    if (league.name) return league.name;
    return (state.game && state.game.league && state.game.league.name) || "";
  }

  // „Spiele laufen noch". Tabelle und Torschützenliste zählen nur beendete
  // Partien; solange gespielt wird, sind sie nicht falsch, sondern
  // unvollständig. Das muss im Bild stehen.
  function runningNote() {
    var running = (state.league && state.league.running_games) || [];
    if (!running.length) return "";

    return running.length === 1
      ? "Ein Spiel läuft noch und ist hier noch nicht enthalten."
      : running.length +
          " Spiele laufen noch und sind hier noch nicht enthalten.";
  }

  function ownTeamIds() {
    var game = state.game;
    if (!game) return [];
    return [game.home && game.home.id, game.guest && game.guest.id].filter(
      function (id) {
        return typeof id === "number";
      }
    );
  }

  function germanDate(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return String(iso);
    return parts[2] + "." + parts[1] + "." + parts[0];
  }

  // ── Die einzelnen Bilder ────────────────────────────────────────────────

  function fsStartbild() {
    var game = state.game;
    if (!game) return null;

    var league = game.league || {};
    var arena = game.arena || {};
    var referees = (game.referees || [])
      .map(function (ref) {
        return [ref.first_name, ref.last_name].filter(Boolean).join(" ");
      })
      .filter(Boolean)
      .join(" / ");

    return {
      // Startbild und Endstand sind Hero-Bilder mit wenig Inhalt: senkrecht
      // mittig statt oben klebend, sonst steht die untere Bildhälfte leer.
      center: true,
      league: league.name || "",
      title: league.game_day ? "Spieltag " + league.game_day : "",
      sub: germanDate(game.date),
      body: fragment([
        matchGrid("gegen", true),
        factRow([
          {
            label: "Anwurf",
            value: game.start_time ? game.start_time + " Uhr" : "",
          },
          { label: "Halle", value: arena.name || "" },
          { label: "Schiedsrichter", value: referees },
        ]),
      ]),
    };
  }

  function fsLineupHome() {
    return lineupContent("home");
  }

  function fsLineupGuest() {
    return lineupContent("guest");
  }

  function lineupContent(side) {
    var game = state.game;
    if (!game) return null;

    var squad = (game.players && game.players[side]) || [];
    var team = (side === "home" ? game.home : game.guest) || {};

    // Wer in der Startaufstellung steht, wird hervorgehoben. `starting_players`
    // liefert immer sechs Positionen, auch unbesetzte; die leeren haben eine
    // leere player_id und dürfen nichts markieren.
    var startingIds = (
      (game.starting_players && game.starting_players[side]) ||
      []
    )
      .map(function (entry) {
        return entry && entry.player_id;
      })
      .filter(Boolean);

    var groups = [
      { title: "Tor", players: [] },
      { title: "Feld", players: [] },
    ];
    for (var i = 0; i < squad.length; i++) {
      var player = squad[i];
      (player.position === "Tor" ? groups[0] : groups[1]).players.push(player);
    }

    var body;
    if (!squad.length) {
      body = node("p", "ov-fs-empty", "Noch keine Aufstellung erfasst.");
    } else {
      body = node("div", "ov-fs-columns");
      for (var g = 0; g < groups.length; g++) {
        if (!groups[g].players.length) continue;

        var block = node("div", "ov-fs-group");
        block.appendChild(node("div", "ov-fs-group-title", groups[g].title));
        for (var p = 0; p < groups[g].players.length; p++) {
          block.appendChild(playerRow(groups[g].players[p], startingIds));
        }
        body.appendChild(block);
      }
    }

    return {
      league: (game.league && game.league.name) || "",
      title: team.name || team.short_name || "",
      sub: "Aufstellung",
      body: body,
    };
  }

  function playerRow(player, startingIds) {
    var starting = startingIds.indexOf(player.player_id) !== -1;
    var row = node(
      "div",
      "ov-fs-player" + (starting ? " ov-fs-player--starting" : "")
    );
    row.appendChild(
      node(
        "span",
        "ov-fs-player-number",
        player.trikot_number === undefined || player.trikot_number === null
          ? ""
          : player.trikot_number
      )
    );
    row.appendChild(
      node(
        "span",
        null,
        [player.player_firstname, player.player_name].filter(Boolean).join(" ")
      )
    );
    return row;
  }

  function fsIntermission() {
    var game = state.game;
    if (!game) return null;

    var period = game.current_period_title || {};

    return {
      league: (game.league && game.league.name) || "",
      title: period.title || "Drittelpause",
      sub: teamLabel(game.home) + " gegen " + teamLabel(game.guest),
      body: fragment([periodTable(game), goalList(game), penaltyBalance(game)]),
    };
  }

  // Ergebnisse je Abschnitt. Nur Abschnitte, in denen gespielt wird: Die
  // Pausen stehen ebenfalls in `period_titles` (mit halben Nummern), haben
  // aber kein Ergebnis.
  function periodTable(game) {
    var result = game.result || {};
    var home = result.home_goals_period || [];
    var guest = result.guest_goals_period || [];
    var period = game.current_period_title || {};
    // Nur bis zum laufenden Abschnitt. Ohne diese Grenze stünde in der ersten
    // Drittelpause „3. Drittel 0:0" im Bild — ein Ergebnis für einen
    // Abschnitt, der noch gar nicht gespielt wurde.
    var current =
      typeof period.period === "number" ? Math.floor(period.period) : null;

    var titles = (game.period_titles || []).filter(function (entry) {
      if (entry.running !== true || entry.period !== Math.floor(entry.period)) {
        return false;
      }
      var index = entry.period - 1;
      if (index < 0 || index >= Math.max(home.length, guest.length))
        return false;
      if (current !== null) return entry.period <= current;

      // Beendetes Spiel ohne laufenden Abschnitt: die regulären Abschnitte
      // immer, Verlängerung und Penalty-Schießen nur, wenn dort Tore fielen.
      return (
        entry.optional === false ||
        Boolean(home[index]) ||
        Boolean(guest[index])
      );
    });
    if (!titles.length) return null;

    var columns = [{ label: "" }];
    var homeCells = [teamLabel(game.home)];
    var guestCells = [teamLabel(game.guest)];

    for (var i = 0; i < titles.length; i++) {
      var index = titles[i].period - 1;
      columns.push({ label: titles[i].short_title, numeric: true });
      // Kein `|| 0`: Der Filter oben lässt einen Abschnitt schon durch, wenn NUR
      // eine Seite einen Wert hat. Die kürzere Seite hätte dann eine 0 gezeigt,
      // also einen Abschnittsstand behauptet, den niemand erfasst hat. Ein
      // Gedankenstrich sagt "unbekannt", die 0 sagt "keine Tore".
      homeCells.push(numberOr(home[index], "—"));
      guestCells.push(numberOr(guest[index], "—"));
    }
    if (columns.length === 1) return null;

    columns.push({ label: "Gesamt", numeric: true, strong: true });
    homeCells.push(numberOr(result.home_goals, "—"));
    guestCells.push(numberOr(result.guest_goals, "—"));

    // Schmal statt über die ganze Breite: Zwei Zeilen mit vier Zahlen sähen
    // auf 1920 Pixeln auseinandergerissen aus.
    return dataTable(
      columns,
      [{ cells: homeCells }, { cells: guestCells }],
      "ov-fs-table--narrow"
    );
  }

  function goalList(game) {
    var goals = (game.events || []).filter(function (event) {
      return event.event_type === "goal";
    });
    if (!goals.length) return null;

    // Zweispaltig wie die Aufstellung: Ein torreiches Drittel passt
    // untereinander nicht auf die Fläche, und abgeschnittene Tore wären
    // schlimmer als eine zweite Spalte.
    var columns = node("div", "ov-fs-columns");
    var block = node("div", "ov-fs-group");
    block.appendChild(node("div", "ov-fs-group-title", "Tore"));
    for (var i = 0; i < goals.length; i++) {
      var goal = goals[i];
      var row = node("div", "ov-fs-player");
      row.appendChild(node("span", "ov-fs-player-number", goal.time || ""));
      row.appendChild(
        node(
          "span",
          null,
          [
            scoreAt(goal),
            goal.scorer_full_name ||
              goal.scorer_name ||
              goal.goal_type_string ||
              "Tor",
            teamName(goal.event_team),
          ]
            .filter(Boolean)
            .join("   ·   ")
        )
      );
      block.appendChild(row);
    }
    columns.appendChild(block);
    return columns;
  }

  // Strafenbilanz je Mannschaft. Die Minuten kommen aus `penalty_type` und
  // nicht aus dem Anzeigetext: Der ist frei gepflegt und ändert sich, die Art
  // nicht. Matchstrafen haben keine Minutenzahl und werden gesondert gezählt.
  function penaltyBalance(game) {
    var sums = {
      home: { minutes: 0, count: 0, match: 0 },
      guest: { minutes: 0, count: 0, match: 0 },
    };
    var events = game.events || [];
    var any = false;

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      if (event.event_type !== "penalty") continue;

      var target = sums[event.event_team];
      if (!target) continue;

      any = true;
      target.count += 1;
      if (PENALTY_MINUTES[event.penalty_type]) {
        target.minutes += PENALTY_MINUTES[event.penalty_type];
      } else if (PENALTY_MATCH_TYPES[event.penalty_type]) {
        target.match += 1;
      } else {
        // Weder Zeit- noch Matchstrafe zuzuordnen: in der Zahl der Strafen
        // mitzählen, aber keine Minuten und keine Matchstrafe behaupten.
        logProblem(
          "Strafe ohne bekannte Zuordnung: " + String(event.penalty_type)
        );
      }
    }
    if (!any) return null;

    // Als Block wie die Tore, nicht als zentrierte Faktenzeile: Beide gehören
    // zur selben Bilanz und sollen auf derselben Kante stehen.
    var block = node("div", "ov-fs-group ov-fs-group--wide-label");
    block.appendChild(node("div", "ov-fs-group-title", "Strafen"));
    ["home", "guest"].forEach(function (side) {
      var row = node("div", "ov-fs-player");
      row.appendChild(
        node(
          "span",
          "ov-fs-player-number",
          teamLabel(side === "home" ? game.home : game.guest)
        )
      );
      row.appendChild(node("span", null, penaltyLabel(sums[side])));
      block.appendChild(row);
    });
    return block;
  }

  function penaltyLabel(sum) {
    var parts = [
      sum.minutes + (sum.minutes === 1 ? " Strafminute" : " Strafminuten"),
    ];
    if (sum.match) {
      parts.push(
        sum.match + (sum.match === 1 ? " Matchstrafe" : " Matchstrafen")
      );
    }
    return parts.join("   ·   ");
  }

  function fsFinal() {
    var game = state.game;
    if (!game) return null;

    var result = game.result || {};
    // KEIN Rückfall auf 0. Fehlt der Stand, ist er unbekannt, und "0 : 0" wäre
    // keine Lücke, sondern eine Falschaussage — im größten Bild, das diese Seite
    // kennt, und in dem, das hinterher herumgeschickt wird. Nachgestellt: ohne
    // `result` stand hier "Endstand 0 : 0". Lieber gar nichts senden.
    if (
      typeof result.home_goals !== "number" ||
      typeof result.guest_goals !== "number"
    ) {
      logProblem(
        "Endstand ohne Spielstand, Vollbild bleibt aus (game " +
          (game.game_id || "?") +
          ")"
      );
      return null;
    }
    var score = result.home_goals + " : " + result.guest_goals;

    return {
      center: true,
      league: (game.league && game.league.name) || "",
      title: game.ended ? "Endstand" : "Zwischenstand",
      sub: (result.postfix && result.postfix.long) || "",
      body: fragment([matchGrid(score, false), awardsBlock(game)]),
    };
  }

  // Auszeichnungen. `awards` liegt immer in beiden Mannschaften vor, auch ohne
  // vergebene Auszeichnung; dann steht dort eine leere player_id und der
  // Eintrag fällt weg.
  function awardsBlock(game) {
    var awards = game.awards || {};
    var row = node("div", "ov-fs-awards");

    ["home", "guest"].forEach(function (side) {
      var entries = awards[side] || [];
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var name = [entry.player_firstname, entry.player_name]
          .filter(Boolean)
          .join(" ");
        if (!name) continue;

        var box = node("div", "ov-fs-award");
        box.appendChild(
          node(
            "span",
            "ov-fs-award-label",
            entry.award === "mvp" ? "Wertvollste Person" : entry.award
          )
        );
        box.appendChild(node("span", "ov-fs-award-name", name));
        box.appendChild(node("span", "ov-fs-award-team", entry.team || ""));
        row.appendChild(box);
      }
    });

    return row.childNodes.length ? row : null;
  }

  function fsTable() {
    var rows = (state.league && state.league.table) || null;
    // Noch kein Abruf: gar nicht senden, es kommt gleich etwas.
    if (!rows) return null;
    // Abruf da, aber leer: DAS ist ein eigener Zustand und muss dastehen. Die
    // Pruefung oben faengt ihn nicht, weil `[]` wahr ist -- uebrig blieben die
    // Spaltenkoepfe ueber einer leeren Flaeche. Auf Sendung liest sich das als
    // Aussage ("diese Liga hat keine Mannschaften") statt als "noch nichts
    // gespielt". Nachgestellt mit leerer Liste: genau diese Kopfzeile ging raus.
    // `lineupContent` behandelt den Fall schon richtig, hier fehlte er.
    if (!rows.length) {
      return {
        league: leagueName(),
        title: "Tabelle",
        body: node(
          "p",
          "ov-fs-empty",
          "Noch keine Tabelle: an diesem Spieltag ist keine Partie beendet."
        ),
        note: runningNote(),
      };
    }

    var own = ownTeamIds();
    var columns = [
      { label: "#", numeric: true },
      { label: "Mannschaft" },
      { label: "Sp", numeric: true },
      { label: "Tore", numeric: true },
      { label: "Diff", numeric: true },
      { label: "Pkt", numeric: true, strong: true },
    ];

    return {
      league: leagueName(),
      title: "Tabelle",
      body: dataTable(
        columns,
        rows.map(function (row) {
          return {
            own: own.indexOf(row.team_id) !== -1,
            cells: [
              row.position,
              teamCell(row.team_name, row.team_logo_small || row.team_logo),
              row.games,
              row.goals_scored + " : " + row.goals_received,
              row.goals_diff > 0 ? "+" + row.goals_diff : row.goals_diff,
              row.points,
            ],
          };
        })
      ),
      note: runningNote(),
    };
  }

  function fsScorer() {
    var rows = (state.league && state.league.scorer) || null;
    // Noch kein Abruf: gar nicht senden, es kommt gleich etwas.
    if (!rows) return null;
    // Abruf da, aber leer: DAS ist ein eigener Zustand und muss dastehen. Die
    // Pruefung oben faengt ihn nicht, weil `[]` wahr ist -- uebrig blieben die
    // Spaltenkoepfe ueber einer leeren Flaeche. Auf Sendung liest sich das als
    // Aussage ("diese Liga hat keine Mannschaften") statt als "noch nichts
    // gespielt". Nachgestellt mit leerer Liste: genau diese Kopfzeile ging raus.
    // `lineupContent` behandelt den Fall schon richtig, hier fehlte er.
    if (!rows.length) {
      return {
        league: leagueName(),
        title: "Torschützen",
        body: node(
          "p",
          "ov-fs-empty",
          "Noch keine Torschützen: an diesem Spieltag ist keine Partie beendet."
        ),
        note: runningNote(),
      };
    }

    var columns = [
      { label: "#", numeric: true },
      { label: "Name" },
      { label: "Mannschaft" },
      { label: "Sp", numeric: true },
      { label: "T", numeric: true },
      { label: "V", numeric: true },
      { label: "Pkt", numeric: true, strong: true },
    ];

    return {
      league: leagueName(),
      title: "Torschützen",
      body: dataTable(
        columns,
        rows.slice(0, FS_SCORER_LIMIT).map(function (row) {
          return {
            cells: [
              row.position,
              [row.first_name, row.last_name].filter(Boolean).join(" "),
              row.team_name,
              row.games,
              row.goals,
              row.assists,
              row.goals + row.assists,
            ],
          };
        })
      ),
      note: runningNote(),
    };
  }

  function fsSchedule() {
    var rows = (state.league && state.league.schedule) || null;
    // Noch kein Abruf: gar nicht senden, es kommt gleich etwas.
    if (!rows) return null;
    // Abruf da, aber leer: DAS ist ein eigener Zustand und muss dastehen. Die
    // Pruefung oben faengt ihn nicht, weil `[]` wahr ist -- uebrig blieben die
    // Spaltenkoepfe ueber einer leeren Flaeche. Auf Sendung liest sich das als
    // Aussage ("diese Liga hat keine Mannschaften") statt als "noch nichts
    // gespielt". Nachgestellt mit leerer Liste: genau diese Kopfzeile ging raus.
    // `lineupContent` behandelt den Fall schon richtig, hier fehlte er.
    if (!rows.length) {
      return {
        league: leagueName(),
        title: "Weitere Spiele",
        body: node(
          "p",
          "ov-fs-empty",
          "Keine weiteren Partien an diesem Spieltag."
        ),
        note: runningNote(),
      };
    }

    var currentId = state.game && state.game.id;
    var columns = [
      { label: "Zeit", numeric: true },
      { label: "Begegnung" },
      { label: "Stand", numeric: true, strong: true },
    ];

    return {
      league: leagueName(),
      title: "Weitere Spiele",
      body: dataTable(
        columns,
        rows.map(function (row) {
          return {
            own: row.game_id === currentId,
            cells: [
              row.time || "",
              (row.home_team_name || "") + " – " + (row.guest_team_name || ""),
              scheduleScore(row),
            ],
          };
        })
      ),
    };
  }

  // Parallel laufende Partien kommen ohne Zwischenstand: Das Token hebt die
  // Verzögerung nur für den eigenen Spieltag auf. „läuft" ist dann die
  // ehrliche Auskunft, ein 0:0 wäre eine falsche.
  function scheduleScore(row) {
    if (row.result_string) return row.result_string;
    if (row.started && !row.ended) return "läuft";
    // `ended` ohne Stand heißt: beendet, Ergebnis kennen wir nicht. Der
    // Gedankenstrich sagt das. Leer bleibt nur, was noch nicht angepfiffen ist --
    // und dafür MUSS `started` auch vorhanden sein. Fehlte das Feld, landete ein
    // laufendes Spiel vorher stumm im Korb "hat noch nicht begonnen".
    if (row.ended) return "—";
    if (typeof row.started !== "boolean") {
      logProblem(
        "Spielplan-Zeile ohne started (game " + (row.game_id || "?") + ")"
      );
      return "—";
    }
    return "";
  }

  poll();
  if (onlyFullscreen) {
    document.body.classList.add("ov-only-fullscreen");
    pollLeague();
  }

  // Die Uhr läuft in ihrem eigenen Takt, unabhängig vom Abruf: Sonst zuckte
  // die Sekundenanzeige im Sekundenraster der Antworten. 10 Hz reicht für eine
  // Anzeige, die nur Minuten und Sekunden zeigt, und übersteht das Drosseln
  // versteckter Quellen, weil jeder Tick neu aus dem Anker rechnet.
  window.setInterval(renderClock, 100);

  // Getrennt vom Abruf: Ob die Anzeige veraltet ist, muss auch dann auffallen,
  // wenn gar keine Antwort mehr kommt.
  window.setInterval(function () {
    renderLiveState();
  }, 1000);
})();
