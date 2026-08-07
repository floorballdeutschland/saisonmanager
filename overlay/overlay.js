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

  var state = {
    lastVersion: null, // game.updated_at der zuletzt geholten Spieldaten
    game: null, // zuletzt erfolgreich geholte Spieldaten
    control: {}, // Steuerzustand aus dem Dock
    errorDelay: ERROR_BACKOFF_START_MS,
    lastOkAt: null,
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
    live: document.getElementById("live"),
    liveLabel: document.getElementById("live-label"),
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
    fetch(buildUrl(), { credentials: "omit", cache: "no-store" })
      .then(function (response) {
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
        // Bewusst nichts zurücksetzen: Die Anzeige behält ihren letzten Stand.
        showDebug("Kein Abruf: " + error.message + "\n" + debugText(), true);
        window.setTimeout(poll, state.errorDelay);
        state.errorDelay = Math.min(state.errorDelay * 2, ERROR_BACKOFF_MAX_MS);
      });
  }

  function apply(body) {
    state.control = body.state || {};

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

    var result = game.result || {};
    el.homeGoals.textContent = numberOr(result.home_goals, 0);
    el.guestGoals.textContent = numberOr(result.guest_goals, 0);

    var period = game.current_period_title || {};
    el.period.textContent = period.title || "";

    var running = Boolean(game.started) && !game.ended;
    el.live.classList.toggle("ov-live--idle", !running);
    el.liveLabel.textContent = game.ended
      ? "Ende"
      : running
        ? "Live"
        : "Gleich";
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
})();
