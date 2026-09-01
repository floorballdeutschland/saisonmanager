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
  var REQUEST_TIMEOUT_MS = 4000;

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
    // Solange ein eigener Schreibvorgang läuft, wird der Zustand aus einer
    // Abfrage nicht zurückgespielt: Sonst springt ein gerade gedrückter Knopf
    // kurz in den alten Zustand.
    writeInFlight: false,
    // Drücke, die während eines laufenden Schreibvorgangs anfielen.
    pendingChanges: null,
    // Bleibt stehen, bis der nächste Schreibvorgang gelingt. Eine verlorene
    // Änderung darf nicht nach zwei Sekunden hinter „Verbunden" verschwinden.
    writeError: null,
    // Endgültig abgewiesen (Token fehlt oder abgelaufen).
    terminal: false,
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
    "lt-onair",
    "sb-position",
    "iv-team",
    "iv-player",
    "iv-show",
    "override-toggle",
    "override-controls",
    "override-display",
    "override-warn",
  ].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  // Tastenkürzel. EINE Tabelle für Wirkung und Beschriftung: `bindHotkeys`
  // löst die Taste über dieselbe Zeile aus, aus der es das Zeichen an den Knopf
  // schreibt. Eine Legende, die daneben pflegbar wäre, liefe irgendwann
  // auseinander.
  //
  // Nur einzelne Tasten ohne Zusatztaste, denn ein Stream Deck schickt genau
  // das. Ziffern für die Bauchbinde, weil sie in einer Reihe liegen; Buchstaben
  // dort, wo sie zum Wort passen.
  var HOTKEYS = [
    { key: "1", sel: "#lt-goal", badge: "1" },
    { key: "2", sel: "#lt-penalty", badge: "2" },
    { key: "3", sel: "#lt-venue", badge: "3" },
    { key: "4", sel: "#lt-text", badge: "4" },
    { key: "0", sel: "#lt-off", badge: "0" },
    { key: "5", sel: "#iv-show", badge: "5" },
    { key: "s", sel: "#scoreboard-toggle", badge: "S" },
    { key: "u", sel: "#clock-visible", badge: "U" },
    { key: " ", sel: "#clock-start", badge: "Leer" },
    { key: "-", sel: "#clock-minus", badge: "−" },
    { key: "+", sel: "#clock-plus", badge: "+" },
    { key: "r", sel: "#clock-reset", badge: "R" },
    { key: "x", sel: "#override-toggle", badge: "X" },
    { key: "q", sel: '[data-ov="home-1"]', badge: "Q" },
    { key: "w", sel: '[data-ov="home+1"]', badge: "W" },
    { key: "o", sel: '[data-ov="guest-1"]', badge: "O" },
    { key: "p", sel: '[data-ov="guest+1"]', badge: "P" },
  ];

  // Bauchbinden-Knopf zu der Art, die er einblendet. Grundlage der
  // Rückmeldung, welcher Knopf gerade in der Bühne steht.
  var LT_BUTTONS = [
    { id: "lt-goal", kind: "goal" },
    { id: "lt-penalty", kind: "penalty" },
    { id: "lt-venue", kind: "venue" },
    { id: "lt-text", kind: "text" },
    { id: "iv-show", kind: "interview" },
  ];

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

  // Wie auf der Bühne: Ein Abruf, der nie zurückkommt, plant auch keinen
  // nächsten ein. Beim Bedienfeld wäre das noch schlimmer, weil ein hängender
  // Schreibvorgang zusätzlich die Übernahme fremder Änderungen dauerhaft
  // blockierte, während oben weiter „Verbunden" steht.
  function fetchWithTimeout(url, options) {
    var controller =
      typeof AbortController === "function" ? new AbortController() : null;
    var opts = Object.assign(
      { credentials: "omit", cache: "no-store" },
      options || {}
    );
    if (controller) opts.signal = controller.signal;

    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, REQUEST_TIMEOUT_MS);

    return fetch(url, opts).then(
      function (res) {
        window.clearTimeout(timer);
        return res;
      },
      function (err) {
        window.clearTimeout(timer);
        throw err;
      }
    );
  }

  function poll() {
    var url = "/api/v2/public/overlay/live?token=" + encodeURIComponent(token);
    if (state.lastVersion !== null) {
      url += "&v=" + encodeURIComponent(state.lastVersion);
    }

    fetchWithTimeout(url)
      .then(function (res) {
        // Kein oder abgelaufenes Token: Weiterfragen bringt nichts, und
        // „HTTP 410" sagt niemandem, was zu tun ist.
        if (res.status === 400 || res.status === 410) {
          state.terminal = true;
          throw new Error(
            "Der Overlay-Zugang ist abgelaufen oder wurde zurückgezogen."
          );
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (body) {
        apply(body);
        state.errorDelay = 2000;
        // Ein gescheiterter Schreibvorgang darf nicht von der nächsten
        // erfolgreichen Abfrage überschrieben werden: Sonst blinkt der Hinweis
        // zwei Sekunden und danach steht wieder „Verbunden", obwohl der Druck
        // verloren ist.
        if (!state.writeError) setStatus("Verbunden", false);
        window.setTimeout(poll, POLL_MS);
      })
      .catch(function (err) {
        setStatus(err.message, true);
        if (state.terminal) return;

        window.setTimeout(poll, state.errorDelay);
        state.errorDelay = Math.min(state.errorDelay * 2, ERROR_BACKOFF_MAX_MS);
      });
  }

  function apply(body) {
    trackClockOffset(body.server_time);

    // Nur übernehmen, wenn die Antwort NEUER ist als der eigene Stand. Eine
    // Abfrage, die vor dem letzten Schreibvorgang losgeschickt wurde, trüge
    // sonst den alten Zeitstempel zurück, und der nächste Druck käme vom
    // Server als veraltet zurück.
    var incoming = body.state_updated_at || null;
    var newer =
      state.stateUpdatedAt === null ||
      (incoming !== null && incoming >= state.stateUpdatedAt);

    if (!state.writeInFlight && newer) {
      state.control = body.state || {};
      state.stateUpdatedAt = incoming;
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
  //
  // Es läuft immer nur EIN Schreibvorgang. Wer währenddessen weiterdrückt,
  // sammelt sich in `pendingChanges` und wird danach nachgeschickt. Ohne das
  // läsen zwei schnell aufeinanderfolgende Drücke denselben Zeitstempel, der
  // zweite käme als veraltet zurück und wäre verloren, gemeldet als fremdes
  // Bedienfeld. Betroffen wären ausgerechnet die Knöpfe, die man mehrfach
  // hintereinander drückt: die Zehn-Sekunden-Schritte und die Übersteuerung.
  function writeState(changes) {
    state.control = Object.assign({}, state.control, changes);
    render();

    if (state.writeInFlight) {
      state.pendingChanges = Object.assign(state.pendingChanges || {}, changes);
      return;
    }

    flushWrite();
  }

  function flushWrite() {
    state.writeInFlight = true;

    fetchWithTimeout(
      "/api/v2/public/overlay/state?token=" + encodeURIComponent(token),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: state.control,
          state_updated_at: state.stateUpdatedAt,
        }),
      }
    )
      .then(function (res) {
        return res.json().then(function (body) {
          return { status: res.status, body: body || {} };
        });
      })
      .then(function (res) {
        if (res.status === 409) {
          // Ein zweites Bedienfeld war schneller. Dessen Stand gewinnt, damit
          // nicht zwei Regien gegeneinander schreiben.
          state.control = res.body.state || {};
          state.stateUpdatedAt = res.body.state_updated_at || null;
          state.pendingChanges = null;
          state.writeError = "Ein anderes Bedienfeld hat den Zustand geändert.";
          setStatus(state.writeError, true);
          return;
        }
        if (res.status < 200 || res.status >= 300) {
          throw new Error(res.body.message || "HTTP " + res.status);
        }

        state.control = res.body.state || {};
        state.stateUpdatedAt = res.body.state_updated_at || null;
        state.writeError = null;
        setStatus("Verbunden", false);
      })
      .catch(function (err) {
        state.writeError = "Nicht gespeichert: " + err.message;
        setStatus(state.writeError, true);
      })
      .then(function () {
        state.writeInFlight = false;

        if (state.pendingChanges) {
          // Der eigene Zustand trägt die Änderung schon, nur der Server nicht.
          state.pendingChanges = null;
          flushWrite();
        } else {
          render();
        }
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
    renderLowerThird();
    renderInterview();
    renderOverride();
  }

  // Welche Einblendung steht gerade in der Bühne? Der Zustand liegt auf dem
  // Server, also weiß das Bedienfeld es auch dann, wenn eine zweite Regie
  // gedrückt hat oder dieses Fenster neu geladen wurde.
  //
  // „Bühne“ und nicht „auf Sendung“: Ob die Bühne im Programm liegt oder
  // gerade ein Vollbild darüber, entscheidet OBS. Das Bedienfeld erfährt davon
  // nichts und darf es deshalb nicht behaupten.
  function renderLowerThird() {
    // Das Bedienfeld muss auch mit einem älteren, zwischengespeicherten
    // dock.html laufen (`Cache-Control` für /overlay/ ist noch offen). Fehlt
    // ein Element, würde der Zugriff werfen -- und weil `render` aus dem Poll
    // heraus läuft, landete der Fehler in der Statuszeile und das Bedienfeld
    // rendert bis zum Neuladen NIE mehr. `bindHotkeys` hält es genauso.
    if (!el["lt-onair"] || !el["lt-off"]) return;

    var lt = state.control.lower_third || null;
    var kind = lt && lt.kind;

    LT_BUTTONS.forEach(function (entry) {
      if (el[entry.id]) {
        el[entry.id].classList.toggle("dk-btn--live", kind === entry.kind);
      }
    });

    // textContent, nicht innerHTML: Der Freitext kommt aus dem Feld daneben.
    el["lt-onair"].textContent = lowerThirdLabel(lt);
    el["lt-onair"].classList.toggle("dk-onair--live", Boolean(kind));

    // Ohne Einblendung gibt es nichts auszublenden. Der abgeschaltete Knopf ist
    // die zweite Rückmeldung: Er zeigt auch ohne Lesen des Textes, dass dieser
    // Bereich gerade nichts in der Bühne hat.
    el["lt-off"].disabled = !kind;
  }

  function lowerThirdLabel(lt) {
    if (!lt || !lt.kind) return "aus";

    if (lt.kind === "goal") return "Bühne: letztes Tor";
    if (lt.kind === "penalty") return "Bühne: letzte Strafe";
    if (lt.kind === "venue") return "Bühne: Paarung";
    // Der eingeblendete Text, nicht der im Feld: Wer nach dem Einblenden
    // weitertippt, soll sehen, was tatsächlich unten im Bild steht.
    if (lt.kind === "text") return "Bühne: " + (lt.main || "Freitext");

    if (lt.kind === "interview") {
      var player = rosterPlayer(lt.side, lt.number);
      // Auch ohne auflösbaren Eintrag die Nummer nennen: Zeigt die Bühne
      // gerade nichts, weil die Aufstellung nachträglich geändert wurde, ist
      // das hier die einzige Spur.
      return (
        "Bühne: Interview " + (player ? playerName(player) : "Nr. " + lt.number)
      );
    }

    return "Bühne: Einblendung";
  }

  function renderGameSelect() {
    if (!state.gameDay) return;

    if (el["game-select"].dataset.filled !== "1") fillGameSelect();

    // Abgleich bei JEDEM Rendern, nicht nur beim Füllen: Sonst zeigt die
    // Auswahl dauerhaft ein anderes Spiel als der Server, etwa wenn der
    // Spieltag vor der ersten Abfrage geladen war, ein zweites Bedienfeld
    // umschaltet oder ein 409 den eigenen Wechsel zurücknimmt.
    var active = state.control.active_game_id || (state.game && state.game.id);
    if (active && el["game-select"].value !== String(active)) {
      el["game-select"].value = String(active);
    }
  }

  function fillGameSelect() {
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
  }

  function renderScoreboard() {
    var on = state.control.scoreboard_visible !== false;
    el["scoreboard-toggle"].textContent = on ? "Sichtbar" : "Ausgeblendet";
    el["scoreboard-toggle"].classList.toggle("dk-toggle--on", on);

    // Ein unbekannter Wert (andere Fassung des Bedienfelds, Tippfehler) laesst
    // die Auswahl leer stehen. Dann lieber den Standard zeigen, den die Bühne
    // in dem Fall ohnehin verwendet.
    el["sb-position"].value =
      state.control.scoreboard_position || "bottom-left";
    if (!el["sb-position"].value) el["sb-position"].value = "bottom-left";

    el["score-line"].textContent = state.game
      ? teamLabel(state.game.home) +
        " " +
        (state.game.result_string || "0:0") +
        " " +
        teamLabel(state.game.guest)
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

  // Ohne Mannschaft bleibt das Feld leer statt „null": OverlayPayload liefert
  // das Objekt auch für ein noch nicht gesetztes Team.
  function teamLabel(team) {
    return (team && (team.short_name || team.name)) || "";
  }

  function formatClock(ms) {
    var total = Math.floor(Math.max(0, ms) / 1000);
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

  // ── Interview ───────────────────────────────────────────────────────────

  // Zwei Auswahlfelder, gefüllt aus der Aufstellung des Spiels. Bewusst keine
  // Eingabe der Nummer von Hand: Eine Zahl, die in der Aufstellung nicht
  // vorkommt, ergäbe eine Bauchbinde ohne Namen, und das fiele erst auf
  // Sendung auf.
  function renderInterview() {
    // Siehe renderLowerThird: ältere Fassung des dock.html im Cache.
    if (!el["iv-team"] || !el["iv-player"] || !el["iv-show"]) return;

    fillInterviewTeams();
    fillInterviewPlayers();

    el["iv-show"].disabled = !el["iv-player"].value;
  }

  function fillInterviewTeams() {
    if (!state.game) return;

    // Neu füllen, sobald ein anderes Spiel gewählt ist: Die Namen stehen in
    // den Feldern, nicht bloß „Heim" und „Gast".
    var key = String(state.game.id);
    if (el["iv-team"].dataset.filledFor === key) return;

    var chosen = el["iv-team"].value === "guest" ? "guest" : "home";
    el["iv-team"].textContent = "";

    [
      { side: "home", team: state.game.home, fallback: "Heim" },
      { side: "guest", team: state.game.guest, fallback: "Gast" },
    ].forEach(function (entry) {
      var opt = document.createElement("option");
      opt.value = entry.side;
      opt.textContent =
        (entry.team && (entry.team.name || entry.team.short_name)) ||
        entry.fallback;
      el["iv-team"].appendChild(opt);
    });

    el["iv-team"].value = chosen;
    el["iv-team"].dataset.filledFor = key;
  }

  function fillInterviewPlayers() {
    if (!state.game) return;

    // Nicht neu bauen, während die Liste geöffnet ist: Chromium schließt sie,
    // wenn ihre Einträge ersetzt werden, und der Klick der Regie landete im
    // Leeren. Passiert, sobald das Sekretariat währenddessen einen Spieler
    // nachträgt.
    if (document.activeElement === el["iv-player"]) return;

    var side = el["iv-team"].value || "home";
    var roster = rosterFor(side);
    // Die Anzahl gehört in den Schlüssel: Wird die Aufstellung erst während
    // des Spiels eingetragen, muss die Liste nachziehen, ohne dass jemand das
    // Dock neu lädt.
    var key = state.game.id + ":" + side + ":" + roster.length;
    if (el["iv-player"].dataset.filledFor === key) return;

    // Die Wahl nur innerhalb DERSELBEN Mannschaft halten. Nach einem
    // Seitenwechsel wäre sie entweder wirkungslos (die andere Mannschaft hat die
    // Nummer nicht, das Feld stünde leer und der Knopf gesperrt, ohne
    // Erklärung) oder still falsch: Hat sie die Nummer auch, wäre plötzlich ein
    // Spieler vorgewählt, den niemand ausgesucht hat.
    var vorherigeSeite = String(el["iv-player"].dataset.filledFor || "").split(
      ":"
    )[1];
    var chosen = vorherigeSeite === side ? el["iv-player"].value : "";
    el["iv-player"].textContent = "";

    if (!roster.length) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Keine Aufstellung eingetragen";
      el["iv-player"].appendChild(empty);
    } else {
      roster.forEach(function (player) {
        var opt = document.createElement("option");
        opt.value = String(player.trikot_number);
        // textContent: Die Namen kommen aus der Datenbank.
        opt.textContent =
          player.trikot_number +
          "  " +
          playerName(player) +
          (player.position === "Tor" ? " (Tor)" : "") +
          // Kommt eine Nummer doppelt vor, tragen beide Einträge denselben Wert
          // in dieser Liste und nur der erste ist ansprechbar (Bühne und Chip
          // lösen beide auf ihn auf). Ohne diesen Zusatz wählt die Regie den
          // zweiten und bekommt ohne Erklärung den Namen des ersten.
          (mehrfacheNummer(roster, player) ? " – Nummer doppelt erfasst" : "");
        el["iv-player"].appendChild(opt);
      });

      if (chosen) el["iv-player"].value = chosen;
    }

    el["iv-player"].dataset.filledFor = key;
  }

  // Nach Trikotnummer sortiert, ohne Einträge ohne Nummer und ohne solche ohne
  // Namen.
  //
  // Nach der Nummer sucht die Regie, ein Eintrag ohne sie ist also nicht
  // ansprechbar. Und einen Eintrag ohne NAMEN blendet die Bühne bewusst nicht
  // ein (eine Bauchbinde mit leerer Namenszeile wäre schlimmer als keine),
  // deshalb gehört er auch nicht in die Auswahl -- sonst führte ein Druck auf
  // Taste 5 sichtbar zu nichts. Beide Fälle gibt es wirklich:
  // `add_player_to_lineup` schreibt `params[:trikot_number].to_i` (ohne Angabe
  // also 0) und übernimmt im Freitext-Zweig die Namen ungeprüft.
  function rosterFor(side) {
    var players = (state.game && state.game.players) || {};
    var list = players[side === "guest" ? "guest" : "home"] || [];

    return list
      .filter(function (player) {
        return player && Number(player.trikot_number) > 0 && playerName(player);
      })
      .slice()
      .sort(function (a, b) {
        return Number(a.trikot_number) - Number(b.trikot_number);
      });
  }

  function mehrfacheNummer(roster, player) {
    var treffer = 0;

    roster.forEach(function (anderer) {
      if (Number(anderer.trikot_number) === Number(player.trikot_number)) {
        treffer += 1;
      }
    });

    return treffer > 1;
  }

  // Der erste Treffer, wie auf der Bühne: Eine Aufstellung kann eine
  // Trikotnummer doppelt enthalten, und beide Einträge tragen in der
  // Auswahlliste denselben Wert. Beide Seiten müssen sich für denselben
  // entscheiden, sonst nennt der Chip einen anderen Namen als das Bild.
  function rosterPlayer(side, number) {
    var roster = rosterFor(side);

    for (var i = 0; i < roster.length; i++) {
      if (Number(roster[i].trikot_number) === Number(number)) return roster[i];
    }

    return null;
  }

  function playerName(player) {
    return [player.player_firstname, player.player_name]
      .filter(Boolean)
      .join(" ");
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

  el["sb-position"].addEventListener("change", function () {
    writeState({ scoreboard_position: el["sb-position"].value });
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

  // `on` statt `el[...].addEventListener`: Bei einem älteren,
  // zwischengespeicherten dock.html fehlt ein Element, und ein Zugriff hier
  // oben braeche die Einrichtung des Bedienfelds ab -- samt aller Zuhörer, die
  // danach kämen.
  function on(id, typ, fn) {
    if (el[id]) el[id].addEventListener(typ, fn);
  }

  on("iv-team", "change", renderInterview);

  on("iv-show", "click", function () {
    var number = el["iv-player"].value;
    if (!number) {
      setStatus(
        "Für das Interview fehlt die Aufstellung dieser Mannschaft.",
        true
      );
      return;
    }

    writeState({
      lower_third: {
        kind: "interview",
        side: el["iv-team"].value || "home",
        number: Number(number),
      },
    });
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

  // ── Tastenkürzel ────────────────────────────────────────────────────────

  // Löst den bestehenden Knopf aus statt die Wirkung ein zweites Mal zu
  // beschreiben: Jede Taste ruft `click()` auf ihrem Knopf, und die Prüfungen
  // dort (kein Tor eingetragen, keine Übersteuerung aktiv, Hauptzeile fehlt)
  // gelten damit für Maus und Taste gleich.
  function bindHotkeys() {
    var lookup = {};

    HOTKEYS.forEach(function (entry) {
      var node = document.querySelector(entry.sel);
      // Ein Knopf, den es nicht gibt, darf den Rest nicht mitnehmen: Das
      // Bedienfeld läuft auch mit einem älteren, zwischengespeicherten
      // dock.html.
      if (!node) return;

      lookup[entry.key] = node;
      node.setAttribute("data-key", entry.badge);
    });

    document.addEventListener("keydown", function (event) {
      // Mit Zusatztaste gehören die Tasten dem Browser und dem Betriebssystem
      // (Neuladen, Suchen, Fenster wechseln).
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      // Eine gehaltene Taste würde sonst zwanzigmal pro Sekunde schreiben.
      if (event.repeat) return;
      // Im Freitextfeld ist eine 1 eine 1 und keine Bauchbinde.
      if (isTypingTarget(event.target)) return;

      var node = lookup[String(event.key).toLowerCase()];
      if (!node) return;

      // Muss VOR dem Auslösen kommen: Ohne das drückte die Leertaste
      // zusätzlich den Knopf, der gerade den Fokus hat, und beim Blättern
      // sprang das Dock weg.
      event.preventDefault();
      node.click();
    });

    // Ein mit der Maus gedrückter Knopf behält den Fokus. Die Leertaste hätte
    // danach ihn ausgelöst und nicht die Uhr gestartet -- also den Fokus nach
    // einem Zeigerklick wieder abgeben. `detail` ist 0, wenn `click()` aus dem
    // Code kommt (Tastenkürzel), und größer, wenn ein Zeiger dahinter steckt.
    el.dock.addEventListener("click", function (event) {
      var target = event.target;
      if (event.detail > 0 && target && target.tagName === "BUTTON") {
        target.blur();
      }
    });

    releaseSelectFocus();
  }

  // DIESE FUNKTION IST DER GRUND, WARUM DIE KÜRZEL BENUTZBAR SIND.
  //
  // Eine Auswahlliste behält nach der Wahl den Fokus -- in Chromium bleibt
  // `document.activeElement` das `select`. `isTypingTarget` zählt sie
  // (richtigerweise) zu den Tippzielen, damit Pfeiltasten und Buchstaben in der
  // offenen Liste funktionieren. Zusammen ergab das eine Falle: Wer die
  // Spielauswahl benutzt, hatte danach TOTE Tastenkürzel, ohne jede
  // Rückmeldung. Nachgestellt: `activeElement` bleibt SELECT, Leertaste und
  // Ziffern wirken nicht mehr.
  //
  // Deshalb: nach einer Wahl PER ZEIGER den Fokus abgeben, wie bei den Knöpfen.
  // Nicht bei Tastaturbedienung -- dort feuert `change` schon beim Blättern mit
  // den Pfeiltasten, und ein Blur mitten darin nähme der Regie die Liste weg.
  function releaseSelectFocus() {
    var zeigerWahl = false;

    el.dock.addEventListener("pointerdown", function (event) {
      if (event.target && event.target.tagName === "SELECT") zeigerWahl = true;
    });

    el.dock.addEventListener("keydown", function (event) {
      if (event.target && event.target.tagName === "SELECT") zeigerWahl = false;
    });

    // In der Bubble-Phase, also NACH den eigentlichen Zuhörern des Feldes: Sie
    // lesen `value` und schreiben den Zustand, das darf ein Blur nicht
    // unterbrechen.
    el.dock.addEventListener("change", function (event) {
      if (!zeigerWahl) return;
      if (!event.target || event.target.tagName !== "SELECT") return;

      zeigerWahl = false;
      event.target.blur();
    });
  }

  function isTypingTarget(node) {
    if (!node || !node.tagName) return false;

    var tag = node.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      node.isContentEditable === true
    );
  }

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

  bindHotkeys();
  poll();
  window.setInterval(renderClockUi, 100);
})();
