/**
 * Erzeugt eine OBS-Szenensammlung für die Livestream-Overlays.
 *
 * Ohne sie muss ein Verein in OBS von Hand eine Browser-Quelle anlegen, sie auf
 * 1920 × 1080 stellen, positionieren und für jedes Vollbild eine eigene Szene
 * bauen. Das sind ein Dutzend Handgriffe, und jeder davon lässt sich verkehrt
 * machen.
 *
 * Anders als sonst bei OBS ist so eine Sammlung voll übertragbar, weil alle
 * Quellen HTTPS-Adressen sind und keine lokalen Dateipfade.
 *
 * ZWEI GRENZEN, DIE IM HINWEISTEXT STEHEN MÜSSEN:
 *
 * 1. Das Bedienfeld ist NICHT enthalten und kann es nicht sein. Ein
 *    benutzerdefiniertes Browser-Dock speichert OBS im Profil, nicht in der
 *    Szenensammlung; es lässt sich über diese Datei also nicht mitliefern und
 *    bleibt ein Handgriff. Der Link dafür steht daneben.
 *
 * 2. Das Token steht im Klartext in der Datei. Wer sie weitergibt, gibt den
 *    Zugang weiter. Nach Ablauf des Tokens ist die Datei wertlos, weil jede
 *    Quelle darin auf einen abgelaufenen Link zeigt.
 */

/** Die Vollbilder, je eine eigene Szene. */
const FULLSCREEN_SCENES: { scene: string; label: string }[] = [
  { scene: 'startbild', label: 'Startbild' },
  { scene: 'aufstellung-heim', label: 'Aufstellung Heim' },
  { scene: 'aufstellung-gast', label: 'Aufstellung Gast' },
  { scene: 'drittelpause', label: 'Drittelpause' },
  { scene: 'tore', label: 'Tore des Spiels' },
  { scene: 'endstand', label: 'Endstand' },
  { scene: 'tabelle', label: 'Tabelle' },
  { scene: 'topscorer', label: 'Torschützen' },
  { scene: 'naechste-spiele', label: 'Nächste Spiele' },
  { scene: 'formkurve', label: 'Formkurve' },
];

const WIDTH = 1920;
const HEIGHT = 1080;

/**
 * Gemeinsame Hülle jeder Quelle. OBS erwartet diese Felder auch dann, wenn sie
 * für eine Browser-Quelle bedeutungslos sind (Lautstärke, Mixer, Hotkeys); ein
 * fehlendes Feld führt beim Import zu einer Quelle mit Standardwerten oder wird
 * stillschweigend übergangen.
 */
function sourceEnvelope(name: string, id: string, settings: object): object {
  return {
    balance: 0.5,
    deinterlace_field_order: 0,
    deinterlace_mode: 0,
    enabled: true,
    flags: 0,
    hotkeys: {},
    id,
    mixers: 0,
    monitoring_type: 0,
    muted: false,
    name,
    prev_ver: 503382016,
    private_settings: {},
    'push-to-mute': false,
    'push-to-mute-delay': 0,
    'push-to-talk': false,
    'push-to-talk-delay': 0,
    settings,
    sync: 0,
    versioned_id: id,
    volume: 1.0,
  };
}

function browserSource(name: string, url: string, shutdown: boolean): object {
  return sourceEnvelope(name, 'browser_source', {
    url,
    width: WIDTH,
    height: HEIGHT,
    // „Quelle beim Ausblenden abschalten": Ohne das fragen alle inaktiven
    // Vollbild-Szenen die ganze Zeit mit — bei neun Szenen also neunfacher
    // Datenverkehr für ein Bild, das niemand sieht. Bei der laufenden Bühne
    // ausdrücklich NICHT gesetzt: Sie soll beim Szenenwechsel nicht neu laden
    // und dabei Uhr und Einblendung verlieren.
    shutdown,
    restart_when_active: false,
    reroute_audio: false,
    fps_custom: false,
    css: '',
  });
}

/** Ein Element in einer Szene: die Quelle links oben, unskaliert. */
function sceneItem(name: string, id: number): object {
  return {
    align: 5,
    blend_method: 'default',
    blend_type: 'normal',
    bounds: { x: 0.0, y: 0.0 },
    bounds_align: 0,
    bounds_type: 0,
    crop_bottom: 0,
    crop_left: 0,
    crop_right: 0,
    crop_top: 0,
    group_item_backup: false,
    hide_transition_duration: 0,
    id,
    locked: false,
    name,
    pos: { x: 0.0, y: 0.0 },
    private_settings: {},
    rot: 0.0,
    scale: { x: 1.0, y: 1.0 },
    scale_filter: 'disable',
    show_transition_duration: 0,
    visible: true,
  };
}

function scene(name: string, sourceName: string): object {
  return sourceEnvelope(name, 'scene', {
    custom_size: false,
    id_counter: 1,
    items: [sceneItem(sourceName, 1)],
  });
}

export interface ObsSceneCollectionInput {
  /** Klartext-Adresse der Bühne, wie sie der Spielbericht ausgibt. */
  overlayUrl: string;
  /** Für den Namen der Sammlung, damit mehrere nebeneinander unterscheidbar sind. */
  collectionName: string;
}

/**
 * Baut die Sammlung. Die Bühne ist die erste Szene und bleibt beim Import die
 * aktive: Wer die Datei einliest und auf Sendung geht, soll die Anzeigetafel
 * sehen und nicht ein Vollbild.
 */
export function buildObsSceneCollection(
  input: ObsSceneCollectionInput
): object {
  const stageSourceName = 'Saisonmanager – Bühne';
  const stageSceneName = 'Bühne (Anzeigetafel & Bauchbinden)';

  const sources: object[] = [
    browserSource(stageSourceName, input.overlayUrl, false),
    scene(stageSceneName, stageSourceName),
  ];
  const order: object[] = [{ name: stageSceneName }];

  for (const entry of FULLSCREEN_SCENES) {
    const sourceName = `Saisonmanager – ${entry.label}`;
    const sceneName = `Vollbild: ${entry.label}`;

    sources.push(
      browserSource(
        sourceName,
        fullscreenUrl(input.overlayUrl, entry.scene),
        true
      )
    );
    sources.push(scene(sceneName, sourceName));
    order.push({ name: sceneName });
  }

  return {
    name: input.collectionName,
    current_scene: stageSceneName,
    current_program_scene: stageSceneName,
    current_preview_scene: stageSceneName,
    scene_order: order,
    sources,
    groups: [],
    transitions: [],
    current_transition: 'Überblenden',
    transition_duration: 300,
    preview_locked: false,
    scaling_enabled: false,
    scaling_level: 0,
    scaling_off_x: 0.0,
    scaling_off_y: 0.0,
    modules: {},
    quick_transitions: [],
    saved_projectors: [],
    virtual_camera_source: null,
  };
}

/**
 * Hängt `only=fullscreen&scene=…` an die Bühnen-Adresse.
 *
 * Über URL statt per Textverkettung: Die Adresse trägt schon `?token=`, und ein
 * angehängtes `?only=` ergäbe eine kaputte Anfrage. Trägt sie wider Erwarten
 * keinen Fragezeichen-Teil, hilft der Fallback.
 */
export function fullscreenUrl(overlayUrl: string, sceneSlug: string): string {
  try {
    const url = new URL(overlayUrl);
    url.searchParams.set('only', 'fullscreen');
    url.searchParams.set('scene', sceneSlug);
    return url.toString();
  } catch {
    const separator = overlayUrl.includes('?') ? '&' : '?';
    return `${overlayUrl}${separator}only=fullscreen&scene=${sceneSlug}`;
  }
}

/**
 * Löst den Download aus. Der Dateiname trägt den Spieltag, damit im
 * Download-Ordner nicht dreimal „szenen.json" liegt.
 */
export function downloadObsSceneCollection(
  collection: object,
  fileName: string
): void {
  const blob = new Blob([JSON.stringify(collection, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  // Freigeben muss sein, sonst bleibt der Blob bis zum Neuladen der Seite im
  // Speicher -- aber erst im naechsten Durchlauf: `click()` stellt den Download
  // nur in die Warteschlange, und wer die Adresse sofort zurueckzieht, bekommt
  // in Safari wortlos keine Datei. Hier waere das besonders teuer, weil der
  // Zugangsschluessel im Klartext nur dieses eine Mal zu haben ist. `csv-export.ts`
  // macht es aus demselben Grund genauso.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}
