/*
 * Bedienfeld der Livestream-Overlays.
 *
 * Liest denselben Endpunkt wie die Bühne und schreibt den Steuerzustand
 * zurück. Der Zustand liegt auf dem Server und nicht im Browser: So überlebt
 * er das Neuladen einer Browser-Quelle mitten im Spiel, und die Regie kann
 * auch von einem zweiten Rechner aus bedienen.
 *
 * Die Uhr wird ausschließlich hier gesetzt. Die Bühne rechnet nur noch aus,
 * was im Zustand steht.
 */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var token = params.get("token");

  var POLL_MS = 2000;
  var ERROR_BACKOFF_MAX_MS = 30000;

  var state = {
    control: {},
    // Zeitstempel des zuletzt gesehenen Zustands. Geht mit jedem Schreiben
    // mit, damit der Server einen Schreibvorgang auf altem Stand abweisen
    // kann (zwei geöffnete Docks).
    stateUpdatedAt: null,
    game: null,
    gameDay: null,
    lastVersion: null,
    clockOffset: null,
    errorDelay: 2000,
    // Solange ein eigener Schreibvorgang läuft, wird der Zustand aus der
    // Antwort nicht in die Bedienelemente zurückgespielt: Sonst springt ein
    // gerade gedrückter Knopf kurz in den alten Zustand zurück.
    writing: false,
  };

  var el = {};
  [
    "dock",
    "status",
    "game-select",
    "scoreboard-toggle",
    "score-line",
    "clock-visible",
    "clock-display",
    "clock-start",
    "clock-minus",
    "clock-plus",
    "clock-reset",
    "clock-drift",
    "lt-goal",
    "lt-penalty",
    "lt-venue",
    "lt-off",
    "lt-text",
    "lt-text-kicker",
    "lt-text-main",
    "override-toggle",
    "override-controls",
    "override-display",
    "override-warn",
  ].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  if (!token) {
    setStatus(
      "Kein Token in der URL. Der Link stammt aus dem Spielbericht.",
      true
    );
    return;
  }

  function setStatus(text, isError) {
    el.status.textContent = text;
    el.status.classList.toggle("dk-status--error", Boolean(isError));
  }

  // ── Abruf ───────────────────────────────────────────────────────────────

  function poll() {
    var url = "/api/v2/public/overlay/live?token=" + encodeURIComponent(token);
    if (state.lastVersion !== null) {
      url += "&v=" + encodeURIComponent(state.lastVersion);
    }

    fetch(url, { credentials: "omit", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (body) {
        apply(body);
        state.errorDelay = 2000;
        setStatus("Verbunden", false);
        window.setTimeout(poll, POLL_MS);
      })
      .catch(function (err) {
        setStatus("Kein Abruf: " + err.message, true);
        window.setTimeout(poll, state.errorDelay);
        state.errorDelay = Math.min(state.errorDelay * 2, ERROR_BACKOFF_MAX_MS);
      });
  }

  function apply(body) {
    trackClockOffset(body.server_time);

    if (!state.writing) {
      state.control = body.state || {};
      state.stateUpdatedAt = body.state_updated_at || null;
    }

    if (body.game) {
      state.game = body.game;
      state.lastVersion = body.game_version;
    } else if (body.game_version !== state.lastVersion) {
      state.lastVersion = null;
    }

    render();
  }

  function trackClockOffset(serverTime) {
    if (typeof serverTime !== "number") return;
    var sample = serverTime - Date.now();
    state.clockOffset =
      state.clockOffset === null
        ? sample
        : state.clockOffset * 0.8 + sample * 0.2;
  }

  function serverNow() {
    return Date.now() + (state.clockOffset || 0);
  }

  // ── Schreiben ───────────────────────────────────────────────────────────

  // Immer der ganze Zustand: Die Einblendungen hängen voneinander ab, ein
  // Teilupdate müsste diese Regeln ein zweites Mal kennen.
  function writeState(changes) {
    var next = Object.assign({}, state.control, changes);
    state.control = next;
    state.writing = true;
    render();

    fetch("/api/v2/public/overlay/state?token=" + encodeURIComponent(token), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: next,
        state_updated_at: state.stateUpdatedAt,
      }),
    })
      .then(function (res) {
        if (res.status === 409) {
          // Ein zweites Dock war schneller. Dessen Stand gewinnt, damit nicht
          // zwei Bedienfelder gegeneinander schreiben.
          return res.json().then(function (body) {
            state.control = body.state || {};
            state.stateUpdatedAt = body.state_updated_at || null;
            setStatus("Ein anderes Bedienfeld hat den Zustand geändert.", true);
          });
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json().then(function (body) {
          state.control = body.state || {};
          state.stateUpdatedAt = body.state_updated_at || null;
          setStatus("Verbunden", false);
        });
      })
      .catch(function (err) {
        setStatus("Nicht gespeichert: " + err.message, true);
      })
      .then(function () {
        state.writing = false;
        render();
      });
  }

  // ── Uhr ─────────────────────────────────────────────────────────────────

  function clockState() {
    return (
      state.control.clock || { running: false, elapsed_ms: 0, visible: true }
    );
  }

  function elapsedMs() {
    var c = clockState();
    var ms = Number(c.elapsed_ms) || 0;
    if (c.running && c.anchor_ms) {
      ms += Math.max(0, serverNow() - Number(c.anchor_ms));
    }
    return ms;
  }

  function setClock(changes) {
    writeState({ clock: Object.assign({}, clockState(), changes) });
  }

  function toggleClockRunning() {
    var c = clockState();
    if (c.running) {
      // Beim Anhalten den erreichten Stand festschreiben, sonst liefe die Uhr
      // beim nächsten Start ab dem alten Anker weiter.
      setClock({ running: false, elapsed_ms: elapsedMs(), anchor_ms: null });
    } else {
      setClock({ running: true, anchor_ms: serverNow() });
    }
  }

  function nudgeClock(deltaMs) {
    var next = Math.max(0, elapsedMs() + deltaMs);
    setClock({
      elapsed_ms: next,
      anchor_ms: clockState().running ? serverNow() : null,
    });
  }

  // ── Anzeige ─────────────────────────────────────────────────────────────

  function render() {
    renderGameSelect();
    renderScoreboard();
    renderClockUi();
    renderOverride();
  }

  function renderGameSelect() {
    if (!state.gameDay || el["game-select"].dataset.filled === "1") return;

    state.gameDay.games.forEach(function (g) {
      var opt = document.createElement("option");
      opt.value = String(g.id);
      // textContent über die Option: Mannschaftsnamen kommen aus der Datenbank.
      opt.textContent =
        (g.start_time ? g.start_time + " " : "") +
        (g.home_team || "?") +
        " gegen " +
        (g.guest_team || "?");
      el["game-select"].appendChild(opt);
    });
    el["game-select"].dataset.filled = "1";

    if (state.control.active_game_id) {
      el["game-select"].value = String(state.control.active_game_id);
    } else if (state.game) {
      el["game-select"].value = String(state.game.id);
    }
  }

  function renderScoreboard() {
    var on = state.control.scoreboard_visible !== false;
    el["scoreboard-toggle"].textContent = on ? "Sichtbar" : "Ausgeblendet";
    el["scoreboard-toggle"].classList.toggle("dk-toggle--on", on);

    el["score-line"].textContent = state.game
      ? state.game.home.short_name +
        " " +
        (state.game.result_string || "0:0") +
        " " +
        state.game.guest.short_name
      : "–";
  }

  function renderClockUi() {
    var c = clockState();
    // Einmal rechnen und weiterreichen: Wenn Anzeige und Abweichungshinweis
    // getrennt rechnen, stehen zwei Zeiten mit einer Sekunde Unterschied
    // untereinander, und das sieht nach einem Fehler aus.
    var ms = elapsedMs();

    el["clock-display"].textContent = formatClock(ms);
    el["clock-start"].textContent = c.running ? "Anhalten" : "Start";

    var visible = c.visible !== false;
    el["clock-visible"].textContent = visible ? "Sichtbar" : "Ausgeblendet";
    el["clock-visible"].classList.toggle("dk-toggle--on", visible);

    renderDrift(ms);
  }

  function formatClock(ms) {
    var total = Math.floor(ms / 1000);
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  // Weicht die getippte Ereigniszeit von der Uhr ab, wird das gemeldet, aber
  // nicht selbsttätig korrigiert: Das Sekretariat tippt von Hand und kann sich
  // vertun, die Entscheidung gehört einem Menschen.
  function renderDrift(ms) {
    var goal = state.game && state.game.last_goal;
    var c = clockState();

    if (!goal || !goal.time || !c.running) {
      el["clock-drift"].classList.add("dk-hidden");
      return;
    }

    var reported = parseClock(goal.time);
    if (reported === null) {
      el["clock-drift"].classList.add("dk-hidden");
      return;
    }

    var diff = Math.abs(reported - ms);
    if (diff < 20000) {
      el["clock-drift"].classList.add("dk-hidden");
      return;
    }

    el["clock-drift"].textContent =
      "Das Sekretariat hat das letzte Tor bei " +
      goal.time +
      " eingetragen, die Uhr steht bei " +
      formatClock(ms) +
      ".";
    el["clock-drift"].classList.remove("dk-hidden");
  }

  function parseClock(text) {
    var m = /^(\d{1,3}):(\d{2})$/.exec(String(text).trim());
    if (!m) return null;
    return (Number(m[1]) * 60 + Number(m[2])) * 1000;
  }

  function renderOverride() {
    var ov = state.control.score_override;
    var on = Boolean(ov);

    el["override-toggle"].textContent = on ? "Aktiv" : "Aus";
    el["override-toggle"].classList.toggle("dk-toggle--on", on);
    el["override-controls"].classList.toggle("dk-hidden", !on);
    el["override-warn"].classList.toggle("dk-hidden", !on);

    if (on) {
      el["override-display"].textContent =
        ov.home_goals + " : " + ov.guest_goals;
    }
  }

  // ── Bedienung ───────────────────────────────────────────────────────────

  el["game-select"].addEventListener("change", function () {
    var id = Number(el["game-select"].value);
    // Spielwechsel setzt die Uhr zurück: Sie gehört zum Spiel, nicht zum Dock.
    writeState({
      active_game_id: id,
      clock: {
        running: false,
        elapsed_ms: 0,
        visible: clockState().visible !== false,
      },
      lower_third: null,
      score_override: null,
    });
    state.lastVersion = null;
  });

  el["scoreboard-toggle"].addEventListener("click", function () {
    writeState({
      scoreboard_visible: state.control.scoreboard_visible === false,
    });
  });

  el["clock-visible"].addEventListener("click", function () {
    setClock({ visible: clockState().visible === false });
  });

  el["clock-start"].addEventListener("click", toggleClockRunning);
  el["clock-minus"].addEventListener("click", function () {
    nudgeClock(-10000);
  });
  el["clock-plus"].addEventListener("click", function () {
    nudgeClock(10000);
  });
  el["clock-reset"].addEventListener("click", function () {
    setClock({ running: false, elapsed_ms: 0, anchor_ms: null });
  });

  el["lt-goal"].addEventListener("click", function () {
    var goal = state.game && state.game.last_goal;
    if (!goal) {
      setStatus("Für dieses Spiel ist noch kein Tor eingetragen.", true);
      return;
    }
    writeState({ lower_third: { kind: "goal", event_id: goal.event_id } });
  });

  el["lt-penalty"].addEventListener("click", function () {
    var penalty = lastPenalty();
    if (!penalty) {
      setStatus("Für dieses Spiel ist noch keine Strafe eingetragen.", true);
      return;
    }
    writeState({
      lower_third: { kind: "penalty", event_id: penalty.event_id },
    });
  });

  el["lt-venue"].addEventListener("click", function () {
    writeState({ lower_third: { kind: "venue" } });
  });

  el["lt-text"].addEventListener("click", function () {
    var main = el["lt-text-main"].value.trim();
    if (!main) {
      setStatus("Für den Freitext fehlt die Hauptzeile.", true);
      return;
    }
    writeState({
      lower_third: {
        kind: "text",
        kicker: el["lt-text-kicker"].value.trim(),
        main: main,
      },
    });
  });

  el["lt-off"].addEventListener("click", function () {
    writeState({ lower_third: null });
  });

  el["override-toggle"].addEventListener("click", function () {
    if (state.control.score_override) {
      writeState({ score_override: null });
      return;
    }
    // Beim Einschalten mit dem echten Stand beginnen, damit niemand von 0:0
    // aus hochzählen muss.
    var result = (state.game && state.game.result) || {};
    writeState({
      score_override: {
        home_goals: Number(result.home_goals) || 0,
        guest_goals: Number(result.guest_goals) || 0,
      },
    });
  });

  el["override-controls"].addEventListener("click", function (event) {
    var action =
      event.target && event.target.dataset && event.target.dataset.ov;
    if (!action) return;

    var ov = state.control.score_override;
    if (!ov) return;

    var next = { home_goals: ov.home_goals, guest_goals: ov.guest_goals };
    var key = action.indexOf("home") === 0 ? "home_goals" : "guest_goals";
    next[key] = Math.max(0, next[key] + (action.indexOf("+1") > -1 ? 1 : -1));
    writeState({ score_override: next });
  });

  function lastPenalty() {
    if (!state.game || !state.game.events) return null;

    var found = null;
    state.game.events.forEach(function (e) {
      if (e.event_type !== "penalty") return;
      if (!found || String(e.sortkey) > String(found.sortkey)) found = e;
    });
    return found;
  }

  // ── Start ───────────────────────────────────────────────────────────────

  // Die Spielliste einmalig holen: Sie ändert sich während einer Übertragung
  // nicht, und das Dock soll nicht bei jedem Abruf denselben Spieltag laden.
  fetch("/api/v2/public/overlay/game_day?token=" + encodeURIComponent(token), {
    credentials: "omit",
    cache: "no-store",
  })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (body) {
      state.gameDay = body;
      render();
    })
    .catch(function (err) {
      setStatus("Spieltag nicht geladen: " + err.message, true);
    });

  poll();
  window.setInterval(renderClockUi, 100);
})();
