// Kursliste zum Einbetten (siehe index.html). Bewusst ohne Framework: Die
// Seite laeuft in fremden iframes und soll klein und unabhaengig vom
// Angular-Build bleiben.
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var root = document.getElementById("kurse");

  var akzent = params.get("akzent");
  if (akzent && /^[0-9a-fA-F]{3,8}$/.test(akzent)) {
    document.documentElement.style.setProperty("--akzent", "#" + akzent);
  }

  var TYPEN = {
    j: "J-Kurs",
    g: "G-Kurs",
    f: "F-Kurs",
    combined: "Kombikurs",
    module: "Modul",
    refresher: "Fortbildung",
    n: "N-Kurs",
    a: "A-Kurs",
    retest: "Nachtest",
    other: "Kurs",
  };
  var FORMATE = {
    in_person: "Präsenz",
    online: "Digital",
    hybrid: "Präsenz und digital",
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function datum(iso, mitZeit) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var opts = {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Berlin",
    };
    if (mitZeit) {
      opts.hour = "2-digit";
      opts.minute = "2-digit";
    }
    return d.toLocaleString("de-DE", opts);
  }

  function euro(cents) {
    return (cents / 100).toFixed(2).replace(".", ",") + " €";
  }

  function hoeheMelden() {
    if (window.parent === window) return;
    window.parent.postMessage(
      {
        type: "saisonmanager-kurse-hoehe",
        height: document.documentElement.scrollHeight,
      },
      "*"
    );
  }

  function kursHtml(k) {
    var basis =
      window.location.origin + "/schiri-kurse/" + encodeURIComponent(k.id);
    var termine = (k.sessions || [])
      .map(function (s) {
        var ort = s.location
          ? " · " + esc(s.location)
          : s.format === "online" || k.format === "online"
            ? " · digital"
            : "";
        return "<li>" + esc(datum(s.starts_at, true)) + ort + "</li>";
      })
      .join("");
    var stufen = (k.license_levels || [])
      .map(function (l) {
        return l.name;
      })
      .join("/");
    var zeilen = [];
    if (k.registration_deadline)
      zeilen.push(
        "Anmeldeschluss: " + esc(datum(k.registration_deadline, true))
      );
    if (k.max_participants != null) {
      zeilen.push(
        k.free_seats
          ? "Freie Plätze: " +
              esc(k.free_seats) +
              " von " +
              esc(k.max_participants)
          : '<span class="voll">ausgebucht, Warteliste möglich</span>'
      );
    }
    if (k.fee_member_cents != null) {
      var gebuehr = "Gebühr: " + esc(euro(k.fee_member_cents));
      if (
        k.fee_non_member_cents != null &&
        k.fee_non_member_cents !== k.fee_member_cents
      ) {
        gebuehr +=
          " (Nichtmitglieder " + esc(euro(k.fee_non_member_cents)) + ")";
      }
      zeilen.push(gebuehr);
    }
    var offen = k.registration_mode === "open" && !k.registration_closed_reason;
    var knopf =
      '<a class="knopf" target="_blank" rel="noopener" href="' +
      esc(basis) +
      '">' +
      (offen ? "Details und Anmeldung" : "Details") +
      "</a>";
    if (k.registration_mode === "open" && k.registration_closed_reason) {
      zeilen.push(esc(k.registration_closed_reason));
    }
    return (
      '<article class="kurs">' +
      "<h2>" +
      esc(k.title) +
      "</h2>" +
      '<p class="meta">' +
      esc(TYPEN[k.course_type] || "Kurs") +
      " · " +
      esc(k.state_association ? k.state_association.name : "Bundesweit (FD)") +
      " · " +
      esc(FORMATE[k.format] || "") +
      (stufen ? " · führt zu " + esc(stufen) : "") +
      "</p>" +
      '<ul class="termine">' +
      termine +
      "</ul>" +
      zeilen
        .map(function (z) {
          return '<p class="zeile">' + z + "</p>";
        })
        .join("") +
      knopf +
      "</article>"
    );
  }

  var query = new URLSearchParams();
  if (params.get("verband"))
    query.set("state_association_id", params.get("verband"));
  if (params.get("format")) query.set("course_format", params.get("format"));
  if (params.get("typ")) query.set("course_type", params.get("typ"));

  fetch("/api/v2/public/referee_courses?" + query.toString(), {
    credentials: "omit",
  })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      var kurse = data.enabled ? data.courses || [] : [];
      root.innerHTML = kurse.length
        ? kurse.map(kursHtml).join("")
        : '<p class="hinweis">Zurzeit sind keine Schiedsrichterkurse ausgeschrieben.</p>';
      hoeheMelden();
    })
    .catch(function () {
      root.innerHTML =
        '<p class="hinweis">Die Kurse konnten gerade nicht geladen werden.</p>';
      hoeheMelden();
    });

  window.addEventListener("resize", hoeheMelden);
})();
