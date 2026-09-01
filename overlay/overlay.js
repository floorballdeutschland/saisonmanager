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
  // offen, fetch wartet ewig, und das Overlay friert für den Rest der
  // Übertragung ein. Deshalb harte Frist statt Vertrauen.
  var REQUEST_TIMEOUT_MS = 4000;
  // Ab wann die Anzeige zugibt, dass sie nichts Neues mehr weiss. Der Live-Punkt
  // geht dann aus, statt einen alten Stand als aktuell auszugeben.
  var STALE_AFTER_MS = 20000;
  // Das mitgelieferte Ligazeichen. Es steht da, solange die Liga kein eigenes
  // hinterlegt hat, und es steht auch wieder da, sobald das Dock auf ein Spiel
  // ohne eigenes Ligazeichen wechselt.
  // Mitgelieferte Bildmarken je Wettbewerb.
  //
  // VORHER LAG HIER DER FEHLER: Es gab genau eine Datei, sie hieß
  // `floorball-bundesliga-weiss.png`, und sie zeigte das POKALZEICHEN (die
  // Spielerfigur mit Pokal). Da weder auf Produktion noch auf dem Testsystem
  // eine einzige Liga ein eigenes Logo hinterlegt hat, lief damit jede
  // Übertragung mit dem Pokalzeichen -- und die CSS-Regel blendete es
  // ausgerechnet beim Pokal aus. Gemeldet wurde es aus einer Partie der
  // 1. Bundesliga.
  //
  // Ein Zeichen ist eine Tatsachenbehauptung, deshalb hat nur ein ZUGEORDNETER
  // Wettbewerb eines: die vier Bundesligen und der Pokal. `damen`, `neutral`
  // und `regional` sind gerade die Schlüssel für „nicht zuzuordnen" (eine
  // Meisterschaft, eine Liga ohne pflegbare Klasse, die Unterklassen) -- dort
  // bleibt die Fläche leer, statt eine fremde Liga auszuweisen. Ein eigenes,
  // hochgeladenes Ligazeichen sticht das ohnehin.
  var COMPETITION_MARKS = {
    "1fbl-m": "img/1-fbl-herren-weiss.png",
    "1fbl-w": "img/1-fbl-damen-weiss.png",
    "2fbl-m": "img/2-fbl-herren-weiss.png",
    "2fbl-w": "img/2-fbl-damen-weiss.png",
    pokal: "img/pokal-weiss.png",
  };

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
    leagueMark: document.getElementById("league-mark"),
    fsMark: document.getElementById("fs-mark"),
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

    applyCompetitionTheme();
    renderControl();
    renderFullscreen();
  }

  // ── Erscheinungsbild je Wettbewerb ──────────────────────────────────────

  // Ligaklassen ohne eigene Bildmarke teilen sich eine Farbwelt.
  var LOWER_CLASSES = { rl: true, vl: true, ll: true };

  // Die Schlüssel, die einen ERKANNTEN Wettbewerb bezeichnen. Gebraucht, um zu
  // trennen, ob ein berechneter Schlüssel wirklich etwas bedeutet oder ins Leere
  // zeigt -- vorher war beides derselbe Zustand ("Attribut fehlt"), und ein
  // unerkannter Wettbewerb lief damit im Bild der 1. Herren.
  //
  // `1fbl-m` steht mit drin, obwohl overlay.css dafür keinen eigenen Block hat:
  // Das IST das Standardaussehen, samt Bundesliga-Wortmarke, und zwar zu Recht.
  // Der Unterschied zu "unerkannt" ist gerade der Punkt.
  var KNOWN_THEMES = {
    "1fbl-m": true,
    "1fbl-w": true,
    "2fbl-m": true,
    "2fbl-w": true,
    pokal: true,
    regional: true,
  };

  // Setzt `data-competition`, worauf overlay.css die Akzentfarben umstellt.
  // Bewusst nicht über die league_id: Ligen sind Zeilen je Saison, eine
  // Liga-Kopie zur neuen Saison bekommt eine neue id. Über die id zugeordnet
  // fiele jedes Erscheinungsbild zum Saisonwechsel still auf den Standard
  // zurück, und es fiele erst auf Sendung auf.
  // Der Wettbewerb, um den es gerade geht. EINE Quelle für Farbwelt und
  // Bildmarke, sonst könnten die beiden auseinanderlaufen: Im Vollbild liegt
  // manchmal nur die ligaweite Antwort vor und noch kein Spiel.
  function currentLeague() {
    return (
      (state.game && state.game.league) ||
      (state.league && state.league.league) ||
      null
    );
  }

  function applyCompetitionTheme() {
    var key = competitionKey(currentLeague());

    if (key) {
      document.documentElement.setAttribute("data-competition", key);
    } else {
      document.documentElement.removeAttribute("data-competition");
    }
  }

  function competitionKey(league) {
    if (!league) return "";

    // Pokalwettbewerbe zuerst. Maßgeblich ist `league_type`, nicht der Name:
    // Dahinter steht `league_modus`, ein Pflicht-Auswahlfeld im Ligaformular mit
    // den Werten league / cup / champ. Und die Formularprüfung verlangt eine
    // Ligaklasse NUR bei `league_modus == 'league'` -- Pokale und Meisterschaften
    // haben also planmäßig keine, sie können unten gar nicht zugeordnet werden.
    //
    // Der Name allein trug nicht: `league.rb` nennt die klassenlosen Wettbewerbe
    // selbst "DM, Pokal, Trophy", und auf Prod heißen mehrere "Floorball
    // Deutschland Cup". Keines davon enthält "Pokal", alle wären im Bild der
    // 1. Bundesliga gelaufen. Das Feld kommt aus api#375.
    if (league.league_type === "cup") return "pokal";
    // Eine Meisterschaft ist keine Bundesliga-Partie. Eigene Farben hat sie
    // nicht, aber die Wortmarke gehoert nicht in ihr Bild.
    if (league.league_type === "champ")
      return league.female ? "damen" : "neutral";

    // Der Name bleibt als Rückfall, für den Fall, dass `league_type` fehlt
    // (ältere API) -- dann aber mit allen drei üblichen Schreibweisen.
    if (
      !league.league_type &&
      /pokal|cup|trophy/i.test(String(league.name || ""))
    ) {
      return "pokal";
    }

    var klasse = league.league_class_id || "";
    var key = "";
    if (LOWER_CLASSES[klasse]) {
      key = "regional";
    } else if (klasse) {
      key = klasse + (league.female ? "-w" : "-m");
    }

    // Zeigt der Schlüssel ins Leere, greift keine Regel und es bleibt beim
    // Standard -- dem Bild der 1. Herren. Bei einer DAMEN-Liga ist das falsch,
    // und zwar sichtbar falsch. Zwei Wege dorthin, beide nachgestellt:
    //
    //   league_class_id leer      -> gar kein Schlüssel   (die Validierung an
    //                                League erlaubt blank ausdrücklich)
    //   league_class_id "10"      -> "10-w", ohne Regel   (Altwert; die API
    //                                sendet die rohe Spalte, nicht
    //                                League.normalize_class_id)
    //
    // Genau die stille Rückkehr zum Standardaussehen, die dieser Entwurf mit dem
    // Verzicht auf die league_id vermeiden wollte -- nur auf einem anderen Weg.
    if (KNOWN_THEMES[key]) return key;

    // Ab hier ist der Wettbewerb NICHT zuzuordnen. Der Standard wäre dann das
    // Bild der 1. Bundesliga Herren, und das ist mehr als eine Farbfrage: Die
    // Wortmarke im Bild ist eine Tatsachenbehauptung. Eine Meisterschaft
    // (`champ`, etwa eine DM-Endrunde) oder eine Liga ohne pflegbare Klasse ist
    // eben keine Bundesliga-Partie.
    //
    // Deshalb zwei eigene Schlüssel statt "kein Attribut": `damen` trägt die
    // Farbwelt der 1. Damen (besser als Markenrot für eine Damen-Partie),
    // `neutral` bleibt bei den Standardfarben. Bei beiden bleibt die
    // Bundesliga-Wortmarke aus, so wie schon bei Pokal und Regional.
    if (league.female) return "damen";
    return "neutral";
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
  // nichts mehr durch (totes Token, Netz weg), wäre das eine Falschaussage:
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

  // Das Zeichen des Wettbewerbs, an BEIDEN Stellen: Anzeigetafel und Vollbild.
  // Sie zeigen dasselbe Zeichen derselben Übertragung.
  //
  // Vorrang hat ein hochgeladenes Ligazeichen. Fehlt es, greift die
  // mitgelieferte Marke des erkannten Wettbewerbs (COMPETITION_MARKS); ist der
  // Wettbewerb nicht zuzuordnen, bleibt die Fläche leer. Ein Verbandslogo käme
  // hier nicht in Frage, es stünde für den falschen Zusammenhang -- deshalb
  // liefert die API an dieser Stelle auch nur ein echtes Ligazeichen.
  //
  // Der Rückweg zählt genauso wie der Hinweg: Wechselt das Dock von einem
  // Spiel mit eigenem Ligazeichen auf eines ohne, muss das erste wieder
  // verschwinden, sonst sendet der Verein das Zeichen des falschen
  // Wettbewerbs.
  function setLeagueMark(league) {
    // Der Schlüssel wird HIER gerechnet und nicht aus dem Zustand gelesen:
    // `apply` baut das Spiel auf, BEVOR es die Farbwelt setzt. Aus dem Zustand
    // gelesen wäre die Marke beim ersten Abruf noch leer und erschiene erst
    // zwei Sekunden später -- auf Sendung ein Aufblitzen ohne Zeichen.
    // Nachgestellt und genau so beobachtet.
    var fallback = COMPETITION_MARKS[competitionKey(currentLeague())] || "";
    var url = (league && league.logo_url) || fallback;

    // Eine Adresse, die schon einmal nicht geladen hat, wird nicht erneut
    // versucht. Sonst fordert sie jede Spielaktualisierung wieder an und das
    // Zeichen flackert auf Sendung zwischen Fehlversuch und Rückfall.
    if (url && url === state.failedLeagueMark) url = fallback;

    applyLeagueMark(url, fallback);
  }

  // Defensiv, weil das Overlay auch mit einem angepassten oder zwischen-
  // gespeicherten index.html laufen kann: Fehlt eines der beiden Elemente,
  // darf das den Aufbau nicht verhindern.
  function leagueMarks() {
    return [el.leagueMark, el.fsMark].filter(Boolean);
  }

  // Die Flächen um die Bilder herum, die mit ausblenden müssen: Sie tragen
  // Innenabstand und eine Trennlinie, ein bloß leeres `img` ließe in der
  // Anzeigetafel eine leere Spalte stehen.
  function markBoxes() {
    return leagueMarks()
      .map(function (img) {
        return img.parentNode;
      })
      .filter(Boolean);
  }

  // Beide Zeichen tragen immer dieselbe Adresse, deshalb genügt ein Zuhörer je
  // Wechsel für beide.
  var leagueMarkErrorHandler = null;

  function applyLeagueMark(url, fallback) {
    // Das frühere `data-own-mark` ist mit dieser Änderung entfallen. Es sagte
    // der CSS, dass ein gepflegtes Zeichen vorliegt, damit die Regel greift,
    // die die EINE mitgelieferte Wortmarke bei Pokal, Regionalliga und
    // Meisterschaft ausblendete. Diese Unterscheidung liegt jetzt hier: Für
    // einen nicht zuzuordnenden Wettbewerb gibt es gar keine mitgelieferte
    // Marke, also auch nichts auszublenden.

    // Der Zuhörer des vorigen Wechsels gehört zu einer Adresse, die nicht mehr
    // auf Sendung ist. Abmelden statt `once`: Ein Zuhörer mit `once`
    // verschwindet nur, wenn er auch feuert, und über eine lange Übertragung
    // sammelten sich sonst die aller erfolgreichen Wechsel an.
    if (leagueMarkErrorHandler) {
      leagueMarks().forEach(function (img) {
        img.removeEventListener("error", leagueMarkErrorHandler);
      });
      leagueMarkErrorHandler = null;
    }

    // Kein Zeichen für diesen Wettbewerb: Fläche weg, und zwar ganz. Das ist
    // der Normalfall bei Pokalrunden ohne eigenes Logo, Regionalligen und
    // Meisterschaften.
    if (!url) {
      markBoxes().forEach(function (box) {
        box.classList.add("ov-mark-empty");
      });
      leagueMarks().forEach(function (img) {
        img.removeAttribute("src");
      });
      return;
    }

    // Auch für die MITGELIEFERTE Marke einen Zuhörer: Fehlt eine der Dateien
    // auf dem Server (Deploy-Fehler), blieb in der Anzeigetafel sonst die
    // gepolsterte Spalte samt Trennlinie und Bruchbild stehen -- während der
    // leere Fall die Fläche ganz entfernt. Ohne eigene Adresse ist der Rückfall
    // das Ausblenden, deshalb hier `applyLeagueMark("", "")`.
    if (url === fallback) {
      leagueMarkErrorHandler = function () {
        logProblem("Mitgelieferte Bildmarke nicht geladen: " + url);
        applyLeagueMark("", "");
      };

      leagueMarks().forEach(function (img) {
        img.addEventListener("error", leagueMarkErrorHandler);
      });
    }

    if (url !== fallback) {
      // Die Adresse steckt in der Closure, nicht im Element: Hat der Abruf
      // zwischenzeitlich auf ein anderes Spiel umgestellt, stünde im Element
      // längst eine andere -- und die funktionierende landete auf der
      // Sperrliste, für die Lebensdauer der Seite.
      leagueMarkErrorHandler = function () {
        state.failedLeagueMark = url;
        applyLeagueMark(fallback, fallback);
      };

      leagueMarks().forEach(function (img) {
        img.addEventListener("error", leagueMarkErrorHandler);
      });
    }

    markBoxes().forEach(function (box) {
      box.classList.remove("ov-mark-empty");
    });
    leagueMarks().forEach(function (img) {
      if (img.getAttribute("src") !== url) img.src = url;
    });
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
    applyScoreboardPosition();
    applyColors();
    // Auch ohne neue Spieldaten: Die Übersteuerung steckt allein im
    // Steuerzustand, sonst wirkte ein Druck im Dock erst beim nächsten
    // Eintrag im Spielbericht.
    if (state.game) renderScore(state.game);
    renderLowerThird();
  }

  // Platzierung der Anzeigetafel. Weißliste statt Durchreichen: Der Wert kommt
  // aus dem Steuerzustand, also von außen. Ein Tippfehler oder ein Wert aus
  // einer späteren Fassung des Bedienfelds setzte sonst ein Attribut, für das
  // hier keine Regel steht -- und die Anzeigetafel landete an einer Stelle, die
  // niemand vorgesehen hat. Unbekanntes fällt auf unten links zurück, den
  // Standard, den auch eine Bühne ohne Dock zeigt.
  var POSITIONS = {
    "bottom-left": true,
    "bottom-center": true,
    "top-left": true,
  };

  function applyScoreboardPosition() {
    var wanted = String(state.control.scoreboard_position || "");
    // `hasOwnProperty` und nicht bloß ein Zugriff: Bei einem Objektliteral sind
    // `constructor`, `__proto__` und `toString` wahrheitswertig, ein solcher
    // Wert wäre also als Attribut durchgereicht worden -- genau das, was die
    // Weißliste verhindern soll. Der Steuerzustand ist frei beschreibbar.
    var erlaubt = Object.prototype.hasOwnProperty.call(POSITIONS, wanted);

    el.stage.setAttribute("data-position", erlaubt ? wanted : "bottom-left");
  }

  // Eigene Farben aus dem Bedienfeld, damit die Einblendungen zu den übrigen
  // Szenen einer Produktion passen (Vereinsfarben).
  //
  // NUR sechsstelliges Hex, sonst gilt weiter die Farbwelt des Wettbewerbs.
  // Das ist keine Formsache: Der Wert kommt aus dem Steuerzustand, landet in
  // einer CSS-Variablen und diese in `background`. Ohne Prüfung könnte dort
  // ein `url(...)` stehen, und die Bühne holte auf Sendung eine fremde Datei.
  //
  // Gesetzt wird am `.ov-stage` und nicht am Wurzelelement: Dort liegt schon
  // `--ov-scale`, die Variablen erben nach innen, und die Regeln je Wettbewerb
  // an `:root[data-competition]` bleiben unangetastet -- ein Rücksetzen
  // braucht deshalb nur diese vier Eigenschaften zu entfernen.
  var HEX_COLOR = /^#[0-9a-f]{6}$/i;

  // Der GEPRÜFTE Wert als Zeichenkette, sonst null.
  //
  // `String()` erst und dann weiterverwenden: `HEX_COLOR.test(String(x))`
  // besteht auch ein einelementiges Array (`String(["#ff0000"])` ist
  // "#ff0000"), und `hexToRgb` rief danach `.slice()` auf dem Array auf --
  // Ergebnis war `rgb(NaN NaN NaN / 16%)` und die Hinterlegung der eigenen
  // Mannschaft in Tabelle und Torschützenliste verschwand lautlos. Der
  // Steuerzustand ist frei beschreibbar, solche Werte sind also möglich.
  function hexOrNull(raw) {
    var text = String(raw);
    return HEX_COLOR.test(text) ? text : null;
  }

  function applyColors() {
    var colors = state.control.colors || {};
    var style = el.stage.style;

    // ZUERST alles Eigene entfernen, DANN die Farben des Wettbewerbs ablesen.
    // Ohne diese Reihenfolge läse der nächste Durchlauf die eigene Farbe des
    // vorigen als "Basis" und die Ligafarbe käme nie wieder zurück. Beides
    // passiert synchron, es gibt also kein Zwischenbild.
    style.removeProperty("--ov-accent");
    style.removeProperty("--ov-accent-alt");
    style.removeProperty("--ov-grad-accent");
    style.removeProperty("--ov-accent-soft");

    var accent = hexOrNull(colors.accent);
    var alt = hexOrNull(colors.accent_alt);
    if (!accent && !alt) return;

    // Je Feld einzeln zurückfallen, nicht als Paar. Das Bedienfeld schickt nur
    // das Feld, das die Regie gesetzt hat: Es kennt die Farbwelt des
    // Wettbewerbs nicht und darf sie deshalb nicht mit einem Standardwert
    // überschreiben. Vorher tat es genau das -- eine Änderung am Verlauf
    // schrieb das Markenrot der 1. Herren als Akzent, und eine Damenpartie
    // sprang auf Sendung ins Rot.
    var basis = window.getComputedStyle(el.stage);
    var wirkAccent = accent || basis.getPropertyValue("--ov-accent").trim();
    var wirkAlt = alt || basis.getPropertyValue("--ov-accent-alt").trim();

    if (accent) style.setProperty("--ov-accent", accent);
    if (alt) style.setProperty("--ov-accent-alt", alt);

    if (wirkAccent && wirkAlt) {
      style.setProperty(
        "--ov-grad-accent",
        "linear-gradient(135deg, " + wirkAccent + " 0%, " + wirkAlt + " 100%)"
      );
    }

    // Die weiche Fläche folgt dem Akzent. Nur bei einem eigenen Akzent
    // anfassen: Für die Ligafarbe steht sie im Stylesheet schon passend, und
    // ein aus `getComputedStyle` gelesener Wert wäre nicht zwingend Hex.
    if (accent) {
      // Dieselbe Schreibweise wie im Stylesheet, nicht color-mix: Die
      // Browser-Quelle ist ein eingebettetes Chromium, dessen Fassung an der
      // OBS-Version hängt.
      style.setProperty("--ov-accent-soft", softColor(accent));
    }
  }

  function softColor(hex) {
    var rgb = hexToRgb(hex);
    return "rgb(" + rgb.join(" ") + " / 16%)";
  }

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
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
      case "interview":
        return interviewContent(lt);
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

  // Namenseinblendung für ein Interview, etwa nach dem Schlusspfiff.
  //
  // Im Steuerzustand stehen nur Mannschaft und Trikotnummer. Name,
  // Torbeteiligung und Auszeichnung werden HIER gerechnet, aus demselben
  // Spielstand, den die Anzeigetafel benutzt: Der Zustand bleibt klein, und
  // trägt das Sekretariat nach dem Einblenden noch eine Vorlage nach, zieht
  // die laufende Bauchbinde von selbst mit.
  function interviewContent(lt) {
    var side = lt.side === "guest" ? "guest" : "home";
    var number = Number(lt.number);
    if (!isFinite(number)) return null;

    var player = rosterPlayer(side, number);
    // Kein Ausweichen auf die Nummer allein: Eine Bauchbinde mit „Nr. 7" ohne
    // Namen hilft niemandem weiter, und eine geänderte Aufstellung soll
    // auffallen, statt halb auf Sendung zu gehen.
    if (!player) return null;

    // Und dasselbe für einen Eintrag OHNE Namen. Den gibt es wirklich:
    // `GamesController#add_player_to_lineup` übernimmt im Freitext-Zweig
    // `player_firstname` und `player_name` ungeprüft aus den Parametern, ein
    // Eintrag mit Nummer und ohne Namen ist also möglich. Ohne diesen Riegel
    // ging die Einblendung mit LEERER Hauptzeile auf Sendung; die Prüfung eine
    // Zeile höher fängt das nicht, sie sieht nur, DASS ein Eintrag da ist.
    var fullName = playerFullName(player);
    if (!fullName) {
      logProblem(
        "Interview: Aufstellungseintrag ohne Namen (Nr. " + number + ")"
      );
      return null;
    }

    var tallies = teamTallies(side);
    var own = tallies[number] || { goals: 0, assists: 0, points: 0 };
    var parts = [];

    if (player.position === "Tor") parts.push(roleLabel("Torhüter"));
    if (player.captain) parts.push(roleLabel("Kapitän"));
    if (own.goals) parts.push(own.goals + (own.goals === 1 ? " Tor" : " Tore"));
    if (own.assists) {
      parts.push(own.assists + (own.assists === 1 ? " Vorlage" : " Vorlagen"));
    }

    var badge = interviewBadge(side, player, own, tallies);
    if (badge) parts.push(badge);

    // Hier der volle Vereinsname und nicht das Kürzel wie auf der
    // Anzeigetafel: Dort zählt der Platz, in einer Namenseinblendung die
    // Lesbarkeit. „BER · Nr. 7" sagt einem Zuschauer nichts.
    var team = side === "home" ? state.game.home : state.game.guest;
    var teamText = (team && (team.name || team.short_name)) || "";

    return {
      kicker: [teamText, "Nr. " + number].filter(Boolean).join("   ·   "),
      main: fullName,
      sub: parts.join("   ·   "),
    };
  }

  // Die Auszeichnung, die mehr über die Partie sagt, gewinnt: Wer MVP ist, ist
  // ausgezeichnet worden; Topscorer ist nur eine Feststellung aus den
  // Ereignissen. Beides nebeneinander machte die Zeile lang, ohne mehr zu
  // sagen.
  function interviewBadge(side, player, own, tallies) {
    if (isMvp(side, player)) return "MVP des Spiels";

    // Punktgleich zählt mit: „Topscorer" ist hier eine Aussage über diese
    // Partie, und bei 2:2 Punkten sind es eben zwei.
    if (own.points > 0 && own.points >= bestPoints(tallies, side)) {
      return "Topscorer der Mannschaft";
    }

    return "";
  }

  // Tore und Vorlagen dieser Mannschaft in DIESEM Spiel, nach Trikotnummer.
  function teamTallies(side) {
    var events = (state.game && state.game.events) || [];
    var tallies = {};

    events.forEach(function (event) {
      if (event.event_type !== "goal" || event.event_team !== side) return;

      countFor(tallies, event.number, "goals");
      countFor(tallies, event.assist, "assists");
    });

    return tallies;
  }

  function countFor(tallies, number, key) {
    var n = Number(number);
    // 1000 und 2000 stehen im Spielbericht ANSTELLE eines Schützen (Eigentor,
    // nicht angegeben). Sie dürfen niemandem zugerechnet werden, auch nicht
    // jemandem, der zufällig diese Nummer trägt.
    if (!isFinite(n) || n === 1000 || n === 2000) return;

    var entry = tallies[n] || { goals: 0, assists: 0, points: 0 };
    entry[key] += 1;
    entry.points += 1;
    tallies[n] = entry;
  }

  // Nur Nummern, die in der Aufstellung stehen. Ein Tor kann auf eine Nummer
  // gebucht sein, die dort nicht (mehr) vorkommt -- etwa nach einer nachträglich
  // geänderten Trikotnummer. Zählte die mit, lag der Bestwert über dem echten
  // und die Auszeichnung „Topscorer der Mannschaft" fiel still aus.
  function bestPoints(tallies, side) {
    var best = 0;

    Object.keys(tallies).forEach(function (number) {
      if (!rosterPlayer(side, number)) return;
      if (tallies[number].points > best) best = tallies[number].points;
    });

    return best;
  }

  function isMvp(side, player) {
    var awards = (state.game && state.game.awards) || {};
    var list = awards[side] || [];
    var hit = false;

    list.forEach(function (entry) {
      if (!entry || entry.award !== "mvp") return;

      // Über die player_id, wo BEIDE eine haben: Trikotnummern werden im
      // Spielbericht nachträglich geändert, die Kennung nicht.
      //
      // `Game#awards_with_player_names` füllt `player_id` und `trikot_number`
      // aus demselben Eintrag, beide sind also entweder gesetzt oder beide
      // leer. Der Nummern-Zweig darunter greift damit nicht für eine
      // Auszeichnung ohne Kennung (die gibt es nicht), sondern wenn der
      // INTERVIEWTE Eintrag keine hat -- ein Freitext-Eintrag in der
      // Aufstellung.
      if (entry.player_id && player.player_id) {
        if (entry.player_id === player.player_id) hit = true;
        return;
      }

      if (
        String(entry.trikot_number || "") !== "" &&
        Number(entry.trikot_number) === Number(player.trikot_number)
      ) {
        hit = true;
      }
    });

    return hit;
  }

  // Der ERSTE Treffer, nicht der letzte. Eine Aufstellung kann eine
  // Trikotnummer doppelt enthalten: `add_player_to_lineup` prüft nur auf
  // doppelte `player_id`, und `Game` hat keine Validierung. Im Bedienfeld
  // tragen zwei Einträge derselben Nummer denselben Wert in der Auswahlliste;
  // die Regie sieht den ZUERST gelisteten. Nahm die Bühne den letzten, ging der
  // Name des anderen Spielers auf Sendung. Beide Seiten nehmen jetzt den
  // ersten.
  function rosterPlayer(side, number) {
    var players = (state.game && state.game.players) || {};
    var list = players[side] || [];

    for (var i = 0; i < list.length; i++) {
      var player = list[i];
      if (!player || !hasTrikotNumber(player)) continue;
      if (Number(player.trikot_number) === Number(number)) return player;
    }

    return null;
  }

  // Eine Trikotnummer im Sinne dieser Anzeige.
  //
  // Die 0 zählt bewusst NICHT: `add_player_to_lineup` schreibt
  // `params[:trikot_number].to_i`, ohne Angabe also die Zahl 0. Sie steht damit
  // für „keine Nummer erfasst", nicht für die Rückennummer 0. Der Server sieht
  // das anders (`OverlayPayload#roster` prüft `.present?`, und `0.present?` ist
  // in Rails true) -- für die Namensauflösung eines Tores ist das dort auch
  // richtig. Hier geht es um eine Auswahl für die Regie, und ein Eintrag ohne
  // erfasste Nummer ist darin nicht ansprechbar.
  function hasTrikotNumber(player) {
    var raw = player.trikot_number;
    if (raw === undefined || raw === null || String(raw).length === 0) {
      return false;
    }
    return Number(raw) > 0;
  }

  function playerFullName(player) {
    return [player.player_firstname, player.player_name]
      .filter(Boolean)
      .join(" ");
  }

  // Die Bezeichnung folgt der Liga, nicht einer Vermutung über die Person: Das
  // Geschlecht steht nirgends am Spieler, das Merkmal `female` aber an der
  // Liga, und danach richtet sich der Rest des Systems auch.
  function roleLabel(word) {
    var league = (state.game && state.game.league) || {};
    return league.female ? word + "in" : word;
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
    tore: { source: null, render: fsGoals },
    endstand: { source: null, render: fsFinal },
    tabelle: { source: "table", render: fsTable },
    topscorer: { source: "scorer", render: fsScorer },
    "naechste-spiele": { source: "schedule", render: fsSchedule },
    formkurve: { source: "form", render: fsForm },
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
        // Auch von hier aus: Ein Tabellen-Vollbild bekommt seine Ligadaten
        // unter Umständen vor dem ersten Spiel-Abruf, und bis dahin stünde es
        // im Standardaussehen.
        applyCompetitionTheme();
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

  // `game_day` ist ein Objekt (`{ game_day_number, title }`), kein Text. Vorher
  // stand es unverändert in der Überschrift, und die Verkettung machte daraus
  // „SPIELTAG [object Object]", in jeder Liga und in jedem Startbild.
  //
  // Genommen wird der `title` allein: Er trägt das Wort „Spieltag" schon selbst,
  // und er deckt die Pokalrunden mit ab („Achtelfinale", „Finale"), wo ein
  // vorangestelltes „Spieltag" schlicht falsch wäre. Die Nummer ist nur der
  // Notnagel, weil `game_days.number` nullable ist und der Titel dann
  // „. Spieltag" lautet.
  function gameDayTitle(gameDay) {
    if (!gameDay) return "";
    if (typeof gameDay !== "object") return "Spieltag " + gameDay;
    if (gameDay.title) return gameDay.title;
    return gameDay.game_day_number ? "Spieltag " + gameDay.game_day_number : "";
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
      title: gameDayTitle(league.game_day),
      sub: germanDate(game.date),
      body: fragment([
        matchGrid("gegen", true),
        factRow([
          {
            label: "Anstoß",
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

  // Bezeichnung der sechs Positionen der Startformation. `starting_players`
  // liefert sie immer alle, auch unbesetzte.
  var STARTING_LABELS = {
    goal: "Tor",
    defender1: "Verteidigung",
    defender2: "Verteidigung",
    center: "Center",
    forward1: "Sturm",
    forward2: "Sturm",
  };

  function lineupContent(side) {
    var game = state.game;
    if (!game) return null;

    var squad = (game.players && game.players[side]) || [];
    var team = (side === "home" ? game.home : game.guest) || {};
    var startingIds = startingPlayerIds(side);

    var body;
    if (!squad.length) {
      body = node("p", "ov-fs-empty", "Noch keine Aufstellung erfasst.");
    } else {
      body = fragment([startingBlock(side), squadColumns(squad, startingIds)]);
    }

    return {
      league: (game.league && game.league.name) || "",
      title: team.name || team.short_name || "",
      sub: "Aufstellung",
      body: body,
    };
  }

  function startingPlayerIds(side) {
    var game = state.game;
    // Immer sechs Positionen, auch unbesetzte; die leeren haben eine leere
    // player_id und dürfen nichts markieren.
    return ((game.starting_players && game.starting_players[side]) || [])
      .map(function (entry) {
        return entry && entry.player_id;
      })
      .filter(Boolean);
  }

  // Die Startformation als eigener Block über dem Kader. Sie steht schon im
  // Spielbericht (`starting_players` mit Tor, zwei Verteidigungen, Center und
  // zwei Sturmpositionen) und war bisher nur als Hervorhebung im Kader zu
  // sehen -- die Positionen selbst gingen dabei verloren.
  //
  // Weitere Blöcke gibt es im Datenmodell nicht, nur diesen einen.
  function startingBlock(side) {
    var entries = (
      (state.game.starting_players && state.game.starting_players[side]) ||
      []
    ).filter(function (entry) {
      // Unbesetzte Positionen weglassen statt leer zeigen: Eine Zeile
      // „Verteidigung" ohne Namen sieht auf Sendung nach einem Fehler aus.
      return entry && entry.player_id;
    });

    if (!entries.length) {
      // Eine erfasste, aber nicht auflösbare Startformation sieht im Bild
      // genauso aus wie eine nicht erfasste: `starting_players_with_numbers`
      // verknüpft über `player_id` und schreibt bei Misserfolg einen leeren
      // Eintrag. Ohne diese Spur wäre der Unterschied nirgends zu sehen.
      var erfasst = (
        (state.game.starting_players && state.game.starting_players[side]) ||
        []
      ).length;

      if (erfasst) {
        logProblem(
          "Startformation " +
            side +
            ": " +
            erfasst +
            " Positionen erfasst, keine auflösbar"
        );
      }

      return null;
    }

    var block = node("div", "ov-fs-group ov-fs-group--lineup");
    block.appendChild(node("div", "ov-fs-group-title", "Startformation"));

    entries.forEach(function (entry) {
      var row = node("div", "ov-fs-player ov-fs-player--starting");
      row.appendChild(
        node(
          "span",
          "ov-fs-player-position",
          STARTING_LABELS[entry.position] || ""
        )
      );
      row.appendChild(node("span", "ov-fs-player-number", numberText(entry)));
      row.appendChild(node("span", null, playerFullName(entry)));
      block.appendChild(row);
    });

    return block;
  }

  // EIN Kader in zwei Spalten, nach Trikotnummer sortiert.
  //
  // Vorher waren es zwei Gruppen, „Tor" und „Feld", und weil
  // `.ov-fs-columns` ein Mehrspalter mit `break-inside: avoid` je Gruppe ist,
  // landeten die Torhüter zwangsläufig allein in der linken Spalte. Genau das
  // war die Rückmeldung: Torhüter und Kapitän gehören gekennzeichnet, nicht in
  // eine eigene Spalte sortiert. Die Zeilen liegen jetzt direkt im
  // Mehrspalter, also füllt der Umbruch beide Spalten gleichmäßig.
  function squadColumns(squad, startingIds) {
    var columns = node("div", "ov-fs-columns");

    squad
      .slice()
      .sort(function (a, b) {
        return numberValue(a) - numberValue(b);
      })
      .forEach(function (player) {
        columns.appendChild(playerRow(player, startingIds));
      });

    return columns;
  }

  // Einträge ohne Trikotnummer nach hinten, nicht an eine beliebige Stelle:
  // `Number("")` ist 0 und stellte sie vor die Nummer 1.
  //
  // Maßgeblich ist `hasTrikotNumber`, dieselbe Regel wie in der
  // Interview-Auswahl. Vorher sortierte die ZAHL 0 nach hinten (`0 || ""` ist
  // "") und die ZEICHENKETTE "0" nach vorn, gedruckt wurde in beiden Fällen
  // eine sichtbare "0" -- Sortierung und Anzeige waren sich also nicht einig.
  function numberValue(player) {
    if (!player || !hasTrikotNumber(player)) return Infinity;
    return Number(player.trikot_number);
  }

  function numberText(player) {
    return player && hasTrikotNumber(player) ? player.trikot_number : "";
  }

  function playerRow(player, startingIds) {
    var starting = startingIds.indexOf(player.player_id) !== -1;
    var row = node(
      "div",
      "ov-fs-player" + (starting ? " ov-fs-player--starting" : "")
    );

    row.appendChild(node("span", "ov-fs-player-number", numberText(player)));
    row.appendChild(node("span", null, playerFullName(player)));

    // Kennzeichnung statt Sortierung. „Tor" wie im Spielbericht, „C" wie im
    // Sport üblich.
    if (player.position === "Tor") {
      row.appendChild(node("span", "ov-fs-player-badge", "Tor"));
    }
    if (player.captain) {
      row.appendChild(node("span", "ov-fs-player-badge", "C"));
    }

    return row;
  }

  // Alle Tore des Spiels in der Reihenfolge, in der sie gefallen sind, nach
  // Abschnitten gruppiert.
  //
  // Die Drittelpause zeigt ebenfalls eine Torliste, aber als eine von drei
  // Angaben und nur mit der Zeit. Hier ist die Torfolge der Inhalt: dazu der
  // Stand nach jedem Treffer, die Mannschaft und die Vorlage.
  //
  // Nach Abschnitt gruppiert und nicht als eine lange Liste, weil `time` je
  // Abschnitt gezaehlt wird: Ohne die Gruppentitel stuenden zwei Tore mit
  // derselben Zeit untereinander, ohne dass jemand den Unterschied sieht.
  //
  // Der Mehrspalter verteilt die Gruppen ALS GANZE auf die beiden Spalten, er
  // teilt keine auf (`.ov-fs-group` trägt `break-inside: avoid`). Ein Spiel mit
  // 15 Toren über vier Abschnitte passt damit; ein einzelner Abschnitt mit
  // einem Dutzend Toren ist ein unteilbarer Block, für den die Dichtestufen
  // aus `fitBody` greifen müssen.
  function fsGoals() {
    var game = state.game;
    if (!game) return null;

    var frame = {
      league: (game.league && game.league.name) || "",
      title: "Tore des Spiels",
      sub: teamLabel(game.home) + " gegen " + teamLabel(game.guest),
    };

    var goals = (game.events || [])
      .filter(function (event) {
        return event.event_type === "goal";
      })
      // `formatted_events` behaelt die Reihenfolge der gespeicherten Ereignisse,
      // und die ist nicht zugesichert -- ein nachtraeglich eingetragenes Tor
      // haengt hinten. `sortkey` ist dafuer gebaut (Abschnitt und Zeit, als
      // Text vergleichbar).
      .slice()
      .sort(function (a, b) {
        var x = String(a.sortkey);
        var y = String(b.sortkey);
        return x < y ? -1 : x > y ? 1 : 0;
      });

    // Benannter Leerzustand statt schwarzem Bild: Fuer einen Vereinsstreamer
    // ist Schwarz nicht von einem kaputten Overlay zu unterscheiden, siehe
    // denselben Fall im Endstandbild.
    if (!goals.length) {
      frame.center = true;
      frame.body = node(
        "p",
        "ov-fs-empty ov-fs-empty--center",
        game.started
          ? "In diesem Spiel ist noch kein Tor gefallen."
          : "Das Spiel hat noch nicht begonnen: Die Tore stehen hier, sobald sie fallen."
      );
      return frame;
    }

    var columns = node("div", "ov-fs-columns");
    var block = null;
    var lastPeriod = null;

    goals.forEach(function (goal) {
      // NORMALISIERT vergleichen, nicht typstreng. `games_controller` speichert
      // `period` unverändert aus den Parametern, und `valid_period?` lässt Zahl
      // UND Zeichenkette zu; `formatted_events` gibt den Wert roh weiter,
      // während das Modell selbst überall `.to_i` benutzt. Ein Tor mit "1"
      // zwischen Toren mit 1 hätte sonst eine zweite Gruppe für dasselbe
      // Drittel geöffnet -- mit anderer Überschrift, weil auch der
      // Titelnachschlag typstreng war.
      var period = periodValue(goal.period);

      if (!block || period !== lastPeriod) {
        block = node("div", "ov-fs-group");
        block.appendChild(
          node("div", "ov-fs-group-title", periodTitleFor(period))
        );
        columns.appendChild(block);
        lastPeriod = period;
      }

      block.appendChild(goalRow(goal));
    });

    frame.body = columns;
    return frame;
  }

  function goalRow(goal) {
    var row = node("div", "ov-fs-player");

    // Eigene Klasse für die Zeit: Die Spalte der Trikotnummern ist 62 px breit
    // und rechtsbündig, eine Angabe wie "12:34" in Oswald 30 px läuft darin
    // nach links über. `fitBody` sieht das nicht, es misst nur die Höhe.
    row.appendChild(node("span", "ov-fs-goal-time", goal.time || ""));

    // Stand und Mannschaft IMMER anlegen, notfalls leer. Beide Spalten haben
    // feste Breiten (damit sie untereinander stehen); ein weggelassenes Element
    // zog die ganze Zeile um seine Breite nach links, und nur diese eine Zeile.
    // Vorkommen: `home_goals` als Zeichenkette gespeichert (dieselbe Quelle wie
    // bei `period`), oder `event_team` leer bei Altdaten.
    row.appendChild(node("span", "ov-fs-goal-score", scoreAt(goal)));
    row.appendChild(node("span", "ov-fs-goal-team", teamName(goal.event_team)));

    // Der abgekuerzte Anzeigename, nicht der volle: Zwei Spalten mit Zeit,
    // Stand, Mannschaft und Vorlage haben keinen Platz fuer "Maximilian".
    // `goal_type_string` traegt Eigentor und "nicht angegeben".
    row.appendChild(
      node(
        "span",
        "ov-fs-goal-scorer",
        goal.scorer_name || goal.goal_type_string || "Tor"
      )
    );

    row.appendChild(
      node(
        "span",
        "ov-fs-goal-assist",
        goal.assist_name ? "Vorlage: " + goal.assist_name : ""
      )
    );

    return row;
  }

  // Der Abschnitt als Zahl, oder null. `Number(undefined)` ist NaN, und NaN
  // ist mit sich selbst nicht gleich -- ohne diese Umsetzung öffnete jedes Tor
  // ohne Abschnitt seine eigene Gruppe.
  function periodValue(raw) {
    var n = Number(raw);
    return isFinite(n) ? n : null;
  }

  // Titel des Abschnitts aus `period_titles`, in dem auch Verlaengerung und
  // Penaltyschiessen stehen. Ohne Treffer die Nummer, damit die Gruppe
  // ueberhaupt eine Ueberschrift hat.
  function periodTitleFor(period) {
    if (period === null) return "Tore";

    var titles = (state.game && state.game.period_titles) || [];
    var found = "";

    titles.forEach(function (entry) {
      // Auch hier normalisiert: `period_titles` trägt echte Zahlen, die
      // Ereignisse nicht zwingend.
      if (entry && periodValue(entry.period) === period) {
        found = entry.title || entry.short_title || "";
      }
    });

    return found || "Abschnitt " + period;
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

    // Vor dem Anpfiff gibt es keinen Stand: `Game#result` bleibt nil, solange
    // `started` nicht gesetzt ist. Damit griff der Riegel darunter, die Szene
    // blieb unsichtbar, und auf Sendung stand ein schwarzes Bild ohne ein Wort
    // dazu. Schwarz ist für Vereinsstreamer aber nicht von einem kaputten
    // Overlay zu unterscheiden: Gemeldet wurde genau das, samt Verdacht auf
    // einen falschen Link und der Neigung, immer neue anzufordern. Tabelle,
    // Torschützenliste und Aufstellung benennen ihren Leerzustand längst, hier
    // fehlte er.
    if (!game.started) {
      return {
        center: true,
        league: (game.league && game.league.name) || "",
        title: "Endstand",
        sub: teamLabel(game.home) + " gegen " + teamLabel(game.guest),
        body: node(
          "p",
          "ov-fs-empty ov-fs-empty--center",
          "Das Spiel hat noch nicht begonnen: Der Endstand steht nach dem Schlusspfiff hier."
        ),
      };
    }

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
    // Prüfung oben fängt ihn nicht, weil `[]` wahr ist -- übrig blieben die
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
    // Prüfung oben fängt ihn nicht, weil `[]` wahr ist -- übrig blieben die
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
    // Prüfung oben fängt ihn nicht, weil `[]` wahr ist -- übrig blieben die
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
        // Kein `runningNote()`, wie im gefüllten Zweig auch nicht: Der Hinweis
        // gehört Tabelle und Torschützenliste. Er wäre hier ohnehin immer leer
        // (`running_games` kommt aus demselben, dann leeren Spielplan), stand
        // aber im Widerspruch zur Begründung weiter unten.
      };
    }

    var currentId = state.game && state.game.id;
    var columns = [
      { label: "Zeit", numeric: true },
      { label: "Begegnung" },
      { label: "Stand", numeric: true, strong: true },
      { label: "" },
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
              schedulePhase(row),
            ],
          };
        })
      ),
      // KEIN `runningNote()` hier. Der Hinweis sagt "läuft noch und ist hier
      // noch nicht enthalten" und gilt Tabelle und Torschützenliste, die nur
      // beendete Spiele zählen. In DIESER Tabelle stehen die laufenden Partien
      // samt Stand -- der Hinweis wäre eine Falschaussage.
    };
  }

  // Parallel laufende Partien kommen ohne Zwischenstand: Das Token hebt die
  // Verzögerung nur für den eigenen Spieltag auf. „läuft" ist dann die
  // ehrliche Auskunft, ein 0:0 wäre eine falsche.
  // Der Stand einer Zeile. Laufende Partien in KLAMMERN: Sie sind der Grund,
  // warum die Übersicht überhaupt Stände zeigt, und der Klammerstand ist das
  // international übliche Zeichen dafür, dass er noch nicht endgültig ist.
  // Vorher stand hier "läuft" ohne Zahl, weil die API die Zwischenstände
  // paralleler Partien gestrichen hat.
  // ── Formkurve ───────────────────────────────────────────────────────────

  // Die letzten Partien beider Mannschaften, neueste zuerst. Je Mannschaft ein
  // Block; `.ov-fs-group` traegt `break-inside: avoid`, die beiden Blöcke landen
  // also je in einer Spalte und werden nicht auseinandergerissen.
  function fsForm() {
    var form = (state.league && state.league.form) || null;
    // Noch kein Abruf: gar nicht senden, es kommt gleich etwas.
    if (!form) return null;

    var teams = [form.home, form.guest].filter(Boolean);
    // Die Unterzeile kommt aus DERSELBEN Nutzlast wie die Blöcke, nicht aus
    // `state.game`. Zwei Gründe:
    //
    //   1. Die Abrufe laufen unterschiedlich schnell (Spiel alle 5 s, Liga alle
    //      30 s). Schaltet das Dock auf ein anderes Spiel, stand in der
    //      Unterzeile bis zu 30 Sekunden die neue Paarung über den Blöcken der
    //      alten -- zwei verschiedene Spiele in einem Bild.
    //   2. Ohne Spieldaten (Vollbild vor dem ersten Spielabruf, oder Zeit-
    //      überschreitung) ergaben die leeren Namen die nackte Zeichenkette
    //      " gegen ". `:empty` greift dagegen nicht, der Text ist nicht leer.
    var namen = teams
      .map(function (team) {
        return team.name || team.short_name || "";
      })
      .filter(Boolean);

    var frame = {
      league: leagueName(),
      title: "Letzte Spiele",
      sub: namen.length === 2 ? namen.join(" gegen ") : namen.join(""),
    };

    // Beide Mannschaften unbekannt: Das ist ein eigener Zustand und muss
    // dastehen, sonst gingen zwei leere Spalten auf Sendung.
    if (!teams.length) {
      frame.body = node(
        "p",
        "ov-fs-empty",
        "Zu diesem Spiel sind keine Mannschaften hinterlegt."
      );
      return frame;
    }

    var columns = node("div", "ov-fs-columns");
    var gewertet = false;

    teams.forEach(function (team) {
      columns.appendChild(formBlock(team));
      (team.games || []).forEach(function (game) {
        if (game.forfait) gewertet = true;
      });
    });

    frame.body = columns;
    // Nur wenn es wirklich vorkommt: Ein „W" ohne Erklaerung ist auf Sendung
    // Rauschen, und die Erklaerung ohne Anlass ebenfalls.
    if (gewertet) {
      frame.note =
        "Mit „W“ gekennzeichnete Partien wurden am grünen Tisch gewertet.";
    }

    return frame;
  }

  function formBlock(team) {
    var block = node("div", "ov-fs-group ov-fs-group--form");
    block.appendChild(
      node("div", "ov-fs-group-title", team.name || team.short_name || "")
    );

    var games = team.games || [];
    if (!games.length) {
      block.appendChild(
        node("p", "ov-fs-empty", "Noch keine beendete Partie.")
      );
      return block;
    }

    games.forEach(function (game) {
      var row = node("div", "ov-fs-player");
      row.appendChild(node("span", "ov-fs-form-date", formDate(game.date)));
      // Heim oder auswaerts: Fuer die Einordnung einer Niederlage macht das den
      // Unterschied.
      row.appendChild(node("span", "ov-fs-form-where", game.home ? "H" : "A"));
      row.appendChild(
        node(
          "span",
          "ov-fs-form-opponent",
          game.opponent_short || game.opponent || ""
        )
      );
      row.appendChild(node("span", "ov-fs-form-score", formScore(game)));
      row.appendChild(outcomeBadge(game));
      block.appendChild(row);
    });

    return block;
  }

  // „2026-09-12" wird „12.09.". Ueber ein Muster und nicht ueber `new Date`:
  // `game_days.date` ist eine Zeichenkette, und ein Altwert in anderer
  // Schreibweise ergaebe „Invalid Date" im Bild. Passt das Muster nicht, steht
  // der Wert da, wie er ist.
  function formDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    if (!match) return value || "";
    return match[3] + "." + match[2] + ".";
  }

  function formScore(game) {
    if (
      typeof game.goals !== "number" ||
      typeof game.opponent_goals !== "number"
    ) {
      // Beendet, Ergebnis unbekannt. Der Gedankenstrich sagt das; eine 0:0
      // waere eine Falschaussage.
      return "—";
    }

    // Negative Tore sind kein Ergebnis, sondern die beidseitige Wertung am
    // grünen Tisch: `League#forfait_goals` setzt dort BEIDE Seiten negativ. Die
    // API gibt dafür keine Wertung aus und leert die Tore inzwischen selbst;
    // der Riegel bleibt, weil die Bühne auch mit einer älteren API läuft.
    if (game.goals < 0 || game.opponent_goals < 0) return "—";

    var stand = game.goals + ":" + game.opponent_goals;
    // Verlängerung und Penaltyschießen gehören in eine Formkurve: Ein Sieg
    // n. V. ist ein anderer als ein regulärer.
    return game.postfix ? stand + " " + game.postfix : stand;
  }

  var OUTCOME_LABELS = { win: "S", draw: "U", loss: "N" };

  function outcomeBadge(game) {
    // `hasOwnProperty`, nicht bloß ein Zugriff: `outcome` kommt von außen, und
    // ein Wert wie "constructor" oder "toString" hätte eine geerbte Funktion
    // als Beschriftung geliefert, samt Funktionsquelltext im Bild. Die API kann
    // das heute nicht senden; `FS_SCENES` wird aus demselben Grund schon so
    // abgefragt.
    var label = Object.prototype.hasOwnProperty.call(
      OUTCOME_LABELS,
      String(game.outcome)
    )
      ? OUTCOME_LABELS[game.outcome]
      : "";
    // Ohne Wertung ein leerer Platzhalter, damit die Spalte darunter nicht
    // verrutscht.
    var badge = node(
      "span",
      "ov-fs-outcome" + (label ? " ov-fs-outcome--" + game.outcome : ""),
      game.forfait ? (label ? label + " W" : "W") : label
    );
    return badge;
  }

  function scheduleScore(row) {
    if (row.result_string) {
      return isRunningRow(row)
        ? "(" + row.result_string + ")"
        : row.result_string;
    }

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
    // KEIN "0:0" für ein angepfiffenes Spiel ohne Stand. Der Fall sieht
    // naheliegend aus, ist aber oben schon erledigt: `Game#schedule_item` setzt
    // `result_string`, sobald `started?`, und `Game#result` liefert für ein
    // angepfiffenes Spiel ohne Ereignisse 0:0 -- die Zeile bekommt also "(0:0)"
    // aus dem ersten Zweig. Hier unten landen nur Zeilen, für die `result` nil
    // ist, und das ist ausschließlich Altbestand ohne Ereignisse. Genau dort
    // kennt niemand den Stand, und "0:0" wäre eine Behauptung.
    if (row.started) return "—";
    return "";
  }

  // Läuft, beendet oder noch nicht angepfiffen -- als Wort neben dem Stand.
  // Bei laufenden Partien der Spielabschnitt, denn zwischen "(1:0) 1. Drittel"
  // und "(1:0) 3. Drittel" liegt für den Zuschauer alles.
  function schedulePhase(row) {
    var text = "";

    if (isRunningRow(row)) {
      var period = row.current_period_title || {};
      text = period.title || period.short_title || "läuft";
    } else if (row.ended) {
      text = "beendet";
    } else if (!row.time) {
      // Sonst steht für "noch nicht angepfiffen" bewusst kein Wort da, weil die
      // Anstoßzeit in der ersten Spalte es schon sagt. `games.start_time` ist
      // aber nullable: Ohne Zeit trug die Zeile nur die Mannschaftsnamen, und
      // nichts sagte, dass die Partie noch aussteht.
      text = "angesetzt";
    }

    if (!text) return "";

    // Als Element und nicht als Text, damit die Spalte gedeckt bleibt:
    // `dataTable` kann je Spalte nur zwischen Zahl und Hervorhebung
    // unterscheiden, und der laufende Abschnitt soll neben dem Stand nicht
    // um Aufmerksamkeit streiten.
    return node("span", "ov-fs-phase", text);
  }

  function isRunningRow(row) {
    return Boolean(row.started) && !row.ended;
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
