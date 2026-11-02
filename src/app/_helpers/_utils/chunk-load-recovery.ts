/**
 * Erkennt und behebt fehlgeschlagene Nachladungen von Programmteilen.
 *
 * Die Anwendung lädt jeden Bereich erst beim Betreten nach (lazy loading), und
 * die Dateinamen tragen einen Hash des Inhalts. Nach einem Deploy heißen sie
 * deshalb anders. Ein Browser, der noch die alte `index.html` hält — ein seit
 * Tagen offener Tab, eine aus dem Cache bediente Seite —, fordert dann eine
 * Datei an, die es nicht mehr gibt.
 *
 * Zwei Dinge fallen dabei zusammen: Der nginx beantwortet den fehlenden Pfad
 * mit dem SPA-Fallback, also mit der `index.html`, und der Browser bekommt für
 * ein erwartetes Modul ein HTML-Dokument. Je nach Browser endet das als
 * „Importing a module script failed." (Safari), „Failed to fetch dynamically
 * imported module" (Chrome) oder, wenn das Dokument tatsächlich als Skript
 * geparst wird, als `SyntaxError: Unexpected token '<'`.
 *
 * Für den Nutzer heißt das: weiße Seite, bis er von selbst neu lädt. Mit rund
 * 18.600 Ereignissen (1862 bei 10 % Sampling) ist das der häufigste Fehler des
 * Frontends überhaupt (Sentry SAISONMANAGER-2B und SAISONMANAGER-2Z).
 *
 * Ein Neuladen behebt es vollständig, denn es holt die `index.html` frisch und
 * damit die Namen der aktuellen Dateien.
 */

/**
 * Merker im sessionStorage, damit ein Neuladen nicht zur Schleife wird.
 *
 * Bewusst sessionStorage und nicht localStorage: Der Zustand gehört zu diesem
 * einen Tab. Ein zweiter Tab mit derselben alten `index.html` hat dasselbe
 * Problem eigenständig und darf sich eigenständig erholen.
 */
export const CHUNK_RELOAD_MARKER = 'sm:chunk-reload';

/**
 * Zeitfenster, innerhalb dessen nicht ein zweites Mal neu geladen wird.
 *
 * Das Neuladen ist ein Versuch, keine Garantie: Fehlt die Datei wirklich —
 * abgebrochenes `scp`, halb hochgeladenes Deploy —, ist sie auch nach dem
 * Neuladen nicht da. Ohne Fenster liefe der Tab dann in eine Endlosschleife
 * und würde den Server dabei im Takt der Ladezeit anfragen. Nach einer Minute
 * darf es erneut versuchen, weil ein weiterer Deploy zwischenzeitlich alles
 * wieder in Ordnung gebracht haben kann.
 */
export const CHUNK_RELOAD_WINDOW_MS = 60_000;

/**
 * Zähler im sessionStorage: wie oft dieser Tab schon wegen eines
 * Chunk-Ladefehlers neu geladen hat.
 *
 * Das Zeitfenster allein reicht als Hinweis auf ein kaputtes Deploy nicht. Der
 * Router setzt die Adresse erst nach erfolgreichem Laden, ein gescheiterter
 * Klick ins Menü lädt also die AUSGANGSSEITE neu. Klickt der Nutzer erst nach
 * einer Minute erneut, wäre jeder Versuch ein stilles Neuladen ohne Meldung.
 * Ab dem zweiten Neuladen im selben Tab meldet der FilteringErrorHandler
 * deshalb, gleich wie viel Zeit dazwischen lag.
 */
export const CHUNK_RELOAD_COUNT = 'sm:chunk-reload-count';

/**
 * Textbausteine, mit denen die Browser ein fehlgeschlagenes Modul melden.
 *
 * Je Browser eine eigene Formulierung, und keine davon ist stabil dokumentiert
 * — deshalb Teilstrings und nicht exakte Vergleiche.
 */
const CHUNK_ERROR_MESSAGES = [
  // Safari / iOS
  'importing a module script failed',
  // Chrome, Edge
  'failed to fetch dynamically imported module',
  // Firefox
  'error loading dynamically imported module',
  // Webpack-Ära; die Meldung lebt in älteren Browsern und in Bibliotheken weiter
  'loading chunk',
  'loading css chunk',
];

/** Ausnahme, ausgepackt aus Angulars zone.js-Hülle (vgl. FilteringErrorHandler). */
function unwrap(error: unknown): unknown {
  const wrapped = error as { ngOriginalError?: unknown } | null;
  return wrapped?.ngOriginalError ?? error;
}

/**
 * Ist der Fehler ein fehlgeschlagenes Nachladen eines Programmteils?
 *
 * Angulars Router wickelt den Ladefehler seinerseits ein, bevor er im
 * ErrorHandler landet, und die ursprüngliche Meldung steht dann nur noch in
 * `cause`. Deshalb wird die Kette mitgelesen — sonst greift die Erkennung
 * ausgerechnet beim häufigsten Weg nicht, dem Wechsel in einen noch nicht
 * geladenen Bereich.
 */
export function isChunkLoadError(error: unknown): boolean {
  let candidate: unknown = unwrap(error);

  // Begrenzt, damit ein selbstbezüglicher `cause`-Verweis nicht hängen bleibt.
  for (let depth = 0; depth < 5 && candidate; depth++) {
    const err = candidate as {
      name?: unknown;
      message?: unknown;
      cause?: unknown;
    };

    if (err.name === 'ChunkLoadError') return true;

    const message =
      typeof err.message === 'string' ? err.message.toLowerCase() : '';
    if (
      message &&
      CHUNK_ERROR_MESSAGES.some((needle) => message.includes(needle))
    ) {
      return true;
    }

    candidate = err.cause;
  }

  return false;
}

/** Was das Neuladen von außen braucht — als Parameter, damit es prüfbar bleibt. */
export interface ChunkRecoveryEnv {
  /** Aktueller Zeitpunkt in Millisekunden. */
  now: () => number;
  /** `sessionStorage`, oder `null`, wenn der Browser keinen hergibt. */
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Ist der Browser nach eigener Auskunft online? */
  online: () => boolean;
  /** Löst das Neuladen aus. */
  reload: () => void;
}

/**
 * Lädt die Seite neu, wenn das im aktuellen Tab noch nicht kürzlich geschah.
 *
 * Gibt zurück, ob neu geladen wurde. `beforeReload` erhält unmittelbar vor dem
 * Neuladen die Zahl der Neuladungen dieses Tabs, diese eingeschlossen. Wann
 * gemeldet wird, entscheidet der FilteringErrorHandler.
 *
 * Ohne Netz wird ebenfalls NICHT neu geladen, siehe die Begründung unten.
 *
 * Ohne nutzbaren Speicher wird NICHT neu geladen. Das trifft den privaten Modus
 * und Browser mit gesperrtem Sitzungsspeicher, ist aber die richtige Seite zum
 * Irren: Ohne Merker ließe sich die Schleife nicht verhindern, und ein Tab, der
 * sich im Sekundentakt selbst neu lädt, ist deutlich schlimmer als eine weiße
 * Seite, die ein Neuladen von Hand behebt.
 */
export function recoverFromChunkLoadError(
  env: ChunkRecoveryEnv,
  beforeReload?: (reloadsInTab: number) => void
): boolean {
  if (!env.storage) return false;

  // Offline NICHT neu laden. Chrome meldet ein Funkloch beim Nachladen mit
  // derselben Zeichenkette wie einen nach dem Deploy verschwundenen Chunk
  // („Failed to fetch dynamically imported module"), die Erkennung oben kann
  // beide also nicht auseinanderhalten. Der Unterschied liegt in der Folge:
  // Nach einem Deploy holt das Neuladen die frische index.html und behebt
  // alles, ohne Netz ersetzt es eine stehende Ansicht durch die Fehlerseite des
  // Browsers -- im Hallen-WLAN mitten aus einem offenen Spielbericht heraus.
  //
  // `navigator.onLine` ist nur ein Hinweis und kein Beweis (true heisst
  // lediglich „irgendeine Verbindung besteht"), aber es irrt in die richtige
  // Richtung: false ist verlaesslich, true kann daneben liegen. Wir verzichten
  // also nur dort auf das Neuladen, wo der Browser sicher weiss, dass er nicht
  // kann.
  if (!env.online()) return false;

  const now = env.now();
  let reloadsInTab: number;

  try {
    const previous = Number(env.storage.getItem(CHUNK_RELOAD_MARKER));
    if (previous && now - previous < CHUNK_RELOAD_WINDOW_MS) return false;

    env.storage.setItem(CHUNK_RELOAD_MARKER, String(now));
    reloadsInTab = (Number(env.storage.getItem(CHUNK_RELOAD_COUNT)) || 0) + 1;
    env.storage.setItem(CHUNK_RELOAD_COUNT, String(reloadsInTab));
  } catch {
    // Speicher vorhanden, aber Schreiben abgelehnt (Kontingent voll, Zugriff
    // gesperrt). Ohne verlässlichen Merker gilt dasselbe wie ohne Speicher.
    return false;
  }

  // Vor dem Neuladen, das laufende Anfragen abbricht: Hier kann der Aufrufer
  // noch melden (siehe CHUNK_RELOAD_COUNT).
  beforeReload?.(reloadsInTab);
  env.reload();
  return true;
}

/**
 * `sessionStorage`, oder `null`, wenn der Zugriff selbst schon wirft.
 *
 * Der reine Zugriff auf `window.sessionStorage` löst in manchen Browsern eine
 * Ausnahme aus, wenn Seitendaten gesperrt sind. Ein `typeof`-Test reicht dort
 * nicht.
 */
export function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}
