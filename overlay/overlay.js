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

  // Der Poll-Takt bestimmt, wie schnell ein Tor auf Sendung geht. Eine Sekunde
  // ist mit dem Versionsabgleich (siehe `v` unten) günstig: Ohne Änderung am
  // Spiel antwortet der Server mit ein paar hundert Byte.
  var POLL_MS = 1000;
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
  // Das mitgelieferte Ligazeichen. Es steht da, solange die Liga kein eigenes
  // hinterlegt hat, und es steht auch wieder da, sobald das Dock auf ein Spiel
  // ohne eigenes Ligazeichen wechselt.
  var DEFAULT_LEAGUE_MARK = "img/floorball-bundesliga-weiss.png";

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
    // Adresse eines Ligazeichens, das nicht geladen hat. Wird nicht erneut
    // versucht, siehe setLeagueMark.
    failedLeagueMark: null,
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
    leagueMark: document.getElementById("league-mark"),
    lowerThird: document.getElementById("lower-third"),
    ltKicker: document.getElementById("lt-kicker"),
    ltMain: document.getElementById("lt-main"),
    ltSub: document.getElementById("lt-sub"),
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
        window.setTimeout(poll, POLL_MS);
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
      state.lastVersion = body.game_version;
      renderGame(state.game);
    } else if (body.game_version !== state.lastVersion) {
      // Der Spielblock fehlt normalerweise, weil sich nichts geändert hat.
      // Weicht die Version trotzdem ab, hat das Dock ein anderes Spiel
      // gewählt: Version vergessen, damit der nächste Abruf die vollen Daten
      // bringt.
      state.lastVersion = null;
    }

    renderControl();
  }

  function renderGame(game) {
    setTeam("home", game.home);
    setTeam("guest", game.guest);
    setLeagueMark(game.league);

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

  // Eigenes Ligazeichen, falls hinterlegt. Der Server liefert hier nur ein
  // echtes Liga-Logo; hat die Liga keines, kommt gar nichts, und es steht das
  // mitgelieferte Bundesliga-Zeichen da. Ein Landesverbandslogo stünde an
  // dieser Stelle für den falschen Zusammenhang.
  //
  // Der Rückweg zählt genauso wie der Hinweg: Wechselt das Dock von einem
  // Spiel mit eigenem Ligazeichen auf eines ohne, muss das erste wieder
  // verschwinden, sonst sendet der Verein das Zeichen des falschen
  // Wettbewerbs.
  function setLeagueMark(league) {
    var url = (league && league.logo_url) || DEFAULT_LEAGUE_MARK;

    // Eine Adresse, die schon einmal nicht geladen hat, wird nicht erneut
    // versucht. Sonst fordert sie jede Spielaktualisierung wieder an und das
    // Zeichen flackert auf Sendung zwischen Fehlversuch und Rückfall.
    if (url === state.failedLeagueMark) url = DEFAULT_LEAGUE_MARK;
    if (el.leagueMark.getAttribute("src") === url) return;

    el.leagueMark.src = url;
  }

  // Lädt das Ligazeichen nicht, zurück auf das mitgelieferte, statt eine Lücke
  // in der Anzeigetafel zu hinterlassen. Ein einziger, dauerhafter Zuhörer
  // statt eines neuen je Quellwechsel: Ein Zuhörer mit `once` verschwindet nur,
  // wenn er auch feuert, und über eine lange Übertragung sammelten sich sonst
  // die der erfolgreichen Wechsel an.
  el.leagueMark.addEventListener("error", function () {
    var failed = el.leagueMark.getAttribute("src");
    if (failed === DEFAULT_LEAGUE_MARK) return;

    state.failedLeagueMark = failed;
    el.leagueMark.src = DEFAULT_LEAGUE_MARK;
  });

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

  poll();

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
