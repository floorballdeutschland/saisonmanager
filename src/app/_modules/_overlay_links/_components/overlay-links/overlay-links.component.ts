import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import * as Sentry from '@sentry/angular';
import { GameService, SessionService } from '@floorball/core';
import { OverlayLinkState } from '@floorball/types';
import {
  buildObsSceneCollection,
  downloadObsSceneCollection,
} from 'src/app/_helpers/_utils/obs-scene-collection';

// Livestream-Overlays. Der Zugang gilt für den ganzen Spieltag, nicht nur
// für ein Spiel: Eine Übertragung zeigt in der Regel mehrere Partien
// hintereinander.
//
// Eigene Komponente in einem eigenen Modul, weil der Abschnitt inzwischen an
// drei Stellen steht: in der Begrüßung des Spielberichts, in dessen Schritt 1
// und auf der Seite „Spielsekretariat", wo der Verein seine Links ausgibt.
// Deshalb hängt sie an einer Spieltags-ID und nicht am Spiel: Auf der
// Sekretariatsseite gibt es gar kein Spiel, nur den Spieltag.
@Component({
  selector: 'fb-overlay-links',
  templateUrl: './overlay-links.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class OverlayLinksComponent implements OnInit, OnDestroy {
  @Input()
  gameDayId?: number | null;

  // Benennt die Szenensammlung und ihre Datei. Wer an einem Tag zwei Spieltage
  // überträgt, unterscheidet die beiden Downloads sonst nur am Zeitstempel.
  @Input()
  label = 'Spieltag';

  // Vorbelegter Zustand für Aufrufer, die ihn schon kennen. Die
  // Sekretariats-Übersicht liefert ihn je Spieltag mit; ohne diesen Weg
  // fragte die Seite ihn für jeden gelisteten Spieltag einzeln nach.
  @Input()
  set knownLink(link: OverlayLinkState | null | undefined) {
    // `undefined` heißt „nicht mitgeliefert", nicht „kein Zugang": Frontend und
    // API werden getrennt ausgerollt, und eine ältere API kennt das Feld noch
    // nicht. Dann bleibt es beim eigenen Abruf, sonst behauptete die Seite bis
    // zum API-Deploy, es liefe nirgends ein Zugang.
    if (link === undefined) return;

    this._knownLinkSet = true;
    this.overlayLink = link;
  }

  // Ohne Anmeldung bleibt der Abschnitt leer. Das Ausblenden gehört an die
  // Komponente selbst: In Schritt 1 sitzt sie in einem Raster, und ein leeres
  // Rasterfeld hinterließe dort eine Lücke.
  @HostBinding('class.hidden')
  public get hidden(): boolean {
    return !this.canManageOverlay;
  }

  public overlayLink: OverlayLinkState | null = null;
  // Klartext-URLs gibt es nur direkt nach dem Erzeugen. Danach liegt
  // serverseitig bloß der Digest, sie lassen sich also nicht nachladen.
  public overlayUrls: { overlay_url: string; dock_url: string } | null = null;
  public overlayBusy = false;
  // Der Zustand ließ sich nicht feststellen (Abruf fehlgeschlagen). Weder
  // „Zugang läuft" noch „kein Zugang", und die Oberfläche sagt das auch so.
  public overlayStateUnknown = false;
  public overlayError = '';
  public overlayCopied = '';
  // Aufgeräumt beim Zerstören der Komponente: Ein Timer, der danach noch
  // markForCheck aufruft, arbeitet auf einer View, die es nicht mehr gibt.
  private _copyResetTimer = 0;
  private _knownLinkSet = false;

  constructor(
    private _gameService: GameService,
    private _sessionService: SessionService,
    private _cdr: ChangeDetectorRef
  ) {}

  // Nur für angemeldete Nutzer. Der Spielbericht rendert auch für das
  // Spielsekretariat, das allein einen Einmal-Token hat und keine Sitzung; die
  // Overlay-Endpunkte verlangen aber eine Anmeldung. Ohne diese Prüfung
  // antwortete der Abruf mit 401, und der ErrorInterceptor meldet daraufhin ab
  // und leitet auf die Anmeldeseite um. Das Sekretariat flöge also mitten im
  // Spiel aus dem Spielbericht.
  public get canManageOverlay(): boolean {
    return Boolean(this._sessionService.currentUser && this.gameDayId);
  }

  public loadOverlayLink(): void {
    if (!this.canManageOverlay) return;

    this._gameService.getOverlayLink(this.gameDayId!).subscribe({
      next: (link) => {
        this.overlayLink = link;
        this.overlayStateUnknown = false;
        this._cdr.markForCheck();
      },
      // Ein Fehlschlag heißt NICHT „kein Zugang". Genau das behauptete die
      // Oberfläche vorher: „Zugang zurückziehen" verschwand, der zweite Knopf
      // hieß wieder „Overlay-Links erzeugen", und der Hinweis auf den
      // bestehenden Zugang fiel weg. Wer sein Token längst als Browser-Quelle
      // in OBS stehen hat, drückt darauf -- und entwertet damit den laufenden
      // Zugang mitten in der Übertragung. Deshalb ein dritter Zustand.
      error: () => {
        this.overlayLink = null;
        this.overlayStateUnknown = true;
        this._cdr.markForCheck();
      },
    });
  }

  public generateOverlayLink(): void {
    if (!this.canManageOverlay || this.overlayBusy) return;

    this.overlayBusy = true;
    this.overlayError = '';
    this._gameService.createOverlayLink(this.gameDayId!).subscribe({
      next: (res) => {
        this.overlayUrls = {
          overlay_url: res.overlay_url,
          dock_url: res.dock_url,
        };
        this.overlayStateUnknown = false;
        this.overlayLink = {
          active: true,
          expires_at: res.expires_at,
          created_by: res.created_by,
        };
        this.overlayBusy = false;
        this._cdr.markForCheck();
      },
      error: (err) => {
        // Klartext wie im übrigen Spielbericht, der ist nicht übersetzt.
        this.overlayError =
          err?.status === 403
            ? 'Für diesen Spieltag darfst du keinen Overlay-Zugang erzeugen.'
            : 'Der Overlay-Zugang konnte nicht erzeugt werden. Bitte später erneut versuchen.';
        this.overlayBusy = false;
        this._cdr.markForCheck();
      },
    });
  }

  public revokeOverlayLink(): void {
    if (!this.canManageOverlay || this.overlayBusy) return;

    this.overlayBusy = true;
    this.overlayError = '';
    this._gameService.revokeOverlayLink(this.gameDayId!).subscribe({
      next: () => {
        this.overlayLink = { active: false };
        this.overlayStateUnknown = false;
        this.overlayUrls = null;
        this.overlayBusy = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.overlayError =
          'Der Zugang konnte nicht zurückgezogen werden. Bitte später erneut versuchen.';
        this.overlayBusy = false;
        this._cdr.markForCheck();
      },
    });
  }

  // Fertige OBS-Szenensammlung zum Herunterladen.
  //
  // Nur direkt nach dem Erzeugen erreichbar, und das ist keine Nachlässigkeit:
  // Der Klartext des Tokens existiert genau einmal, in der Antwort auf
  // #generate!. Serverseitig liegt danach nur der Digest, eine Sammlung ließe
  // sich später also nicht mehr bauen.
  public downloadSceneCollection(): void {
    if (!this.overlayUrls) return;

    // Genau deshalb darf ein Fehlschlag hier nicht stumm bleiben: Wer nichts im
    // Download-Ordner findet und keine Meldung sieht, klickt weiter und muss am
    // Ende den ganzen Zugang neu erzeugen -- mitten im Spieltag, womit die
    // bereits in OBS eingetragenen Adressen ungueltig werden.
    try {
      downloadObsSceneCollection(
        buildObsSceneCollection({
          overlayUrl: this.overlayUrls.overlay_url,
          collectionName: `Saisonmanager – ${this.label}`,
        }),
        `saisonmanager-obs-szenen-${this.gameDayId ?? 'spieltag'}.json`
      );
    } catch (error) {
      Sentry.captureException(error);
      this.overlayError =
        'Die Szenensammlung konnte nicht erzeugt werden. Bitte kopiere stattdessen die Links oben.';
      this._cdr.markForCheck();
    }
  }

  // Fehlschläge müssen auffallen: Der Klartext des Tokens wird genau einmal
  // angezeigt. Wer „Kopiert" liest, obwohl nichts in der Zwischenablage liegt,
  // fügt in OBS etwas Altes ein und muss den Zugang neu erzeugen. Ohne
  // Zwischenablage (unsicherer Kontext) tut der optionale Aufruf nichts und
  // meldete das früher nicht.
  public async copyOverlayUrl(
    kind: 'overlay' | 'dock',
    url: string
  ): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);

      // Kurze Rückmeldung am Knopf, damit erkennbar ist, welcher der beiden
      // Links gerade in der Zwischenablage liegt.
      this.overlayCopied = kind;
      // Eine Meldung des vorigen, gescheiterten Versuchs darf nicht über einem
      // Knopf stehen bleiben, der gerade „Kopiert" anzeigt.
      this.overlayError = '';
      window.clearTimeout(this._copyResetTimer);
      this._copyResetTimer = window.setTimeout(() => {
        this.overlayCopied = '';
        this._cdr.markForCheck();
      }, 2000);
    } catch {
      this.overlayCopied = '';
      this.overlayError =
        'Kopieren war nicht möglich. Bitte markiere den Link und kopiere ihn von Hand.';
    }
    this._cdr.markForCheck();
  }

  ngOnInit(): void {
    if (this._knownLinkSet) return;

    this.loadOverlayLink();
  }

  ngOnDestroy(): void {
    window.clearTimeout(this._copyResetTimer);
  }
}
