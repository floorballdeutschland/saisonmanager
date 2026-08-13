import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import * as Sentry from '@sentry/angular';
import { GameService, LeagueService, SessionService } from '@floorball/core';
import { Game, GameAdditionalFields } from '@floorball/types';
import {
  buildObsSceneCollection,
  downloadObsSceneCollection,
} from 'src/app/_helpers/_utils/obs-scene-collection';
import { tap } from 'rxjs';

@Component({
  selector: 'fb-match-report-step-one',
  templateUrl: './match-report-step-one.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportStepOneComponent
  implements OnInit, OnChanges, OnDestroy
{
  fieldSize!: string;

  homeCoachNums: number[] = [1];
  guestCoachNums: number[] = [1];

  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  @Output()
  handleGameStatusChange = new EventEmitter<void>();

  // lineup properties
  public squadHistoryDialogOpen = '';
  public addDialogOpen = '';

  // Livestream-Overlays. Der Zugang gilt für den ganzen Spieltag, nicht nur
  // für dieses Spiel: Eine Übertragung zeigt in der Regel mehrere Partien
  // hintereinander.
  public overlayLink: {
    active: boolean;
    expires_at?: string;
    created_by?: string;
  } | null = null;
  // Klartext-URLs gibt es nur direkt nach dem Erzeugen. Danach liegt
  // serverseitig bloß der Digest, sie lassen sich also nicht nachladen.
  public overlayUrls: { overlay_url: string; dock_url: string } | null = null;
  public overlayBusy = false;
  public overlayError = '';
  public overlayCopied = '';
  // Aufgeräumt beim Zerstören der Komponente: Ein Timer, der danach noch
  // markForCheck aufruft, arbeitet auf einer View, die es nicht mehr gibt.
  private _copyResetTimer = 0;

  constructor(
    private _leagueService: LeagueService,
    private _gameService: GameService,
    private _sessionService: SessionService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['additionalFields']) {
      const homeCount = this.initCoachCount(
        this.additionalFields?.home_team_coaches
      );
      const guestCount = this.initCoachCount(
        this.additionalFields?.guest_team_coaches
      );
      if (homeCount > this.homeCoachNums.length) {
        this.homeCoachNums = Array.from({ length: homeCount }, (_, i) => i + 1);
      }
      if (guestCount > this.guestCoachNums.length) {
        this.guestCoachNums = Array.from(
          { length: guestCount },
          (_, i) => i + 1
        );
      }
    }
  }

  // ── Livestream-Overlays ───────────────────────────────────────────────

  // Nur für angemeldete Nutzer. Der Spielbericht rendert auch für das
  // Spielsekretariat, das allein einen Einmal-Token hat und keine Sitzung; die
  // Overlay-Endpunkte verlangen aber eine Anmeldung. Ohne diese Prüfung
  // antwortete der Abruf mit 401, und der ErrorInterceptor meldet daraufhin ab
  // und leitet auf die Anmeldeseite um. Das Sekretariat flöge also mitten im
  // Spiel aus dem Spielbericht.
  public get canManageOverlay(): boolean {
    return Boolean(this._sessionService.currentUser && this.game?.game_day_id);
  }

  public loadOverlayLink(): void {
    if (!this.canManageOverlay) return;

    this._gameService.getOverlayLink(this.game.game_day_id!).subscribe({
      next: (link) => {
        this.overlayLink = link;
        this._cdr.markForCheck();
      },
      // Kein Fehlerhinweis: Der Abruf klärt nur, ob schon ein Zugang besteht.
      // Schlägt er fehl, bleibt der Knopf zum Erzeugen stehen.
      error: () => {
        this.overlayLink = null;
        this._cdr.markForCheck();
      },
    });
  }

  public generateOverlayLink(): void {
    if (!this.canManageOverlay || this.overlayBusy) return;

    this.overlayBusy = true;
    this.overlayError = '';
    this._gameService.createOverlayLink(this.game.game_day_id!).subscribe({
      next: (res) => {
        this.overlayUrls = {
          overlay_url: res.overlay_url,
          dock_url: res.dock_url,
        };
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
    this._gameService.revokeOverlayLink(this.game.game_day_id!).subscribe({
      next: () => {
        this.overlayLink = { active: false };
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

    const label = this.game?.game_number
      ? `Spiel ${this.game.game_number}`
      : 'Spieltag';

    // Genau deshalb darf ein Fehlschlag hier nicht stumm bleiben: Wer nichts im
    // Download-Ordner findet und keine Meldung sieht, klickt weiter und muss am
    // Ende den ganzen Zugang neu erzeugen -- mitten im Spieltag, womit die
    // bereits in OBS eingetragenen Adressen ungueltig werden.
    try {
      downloadObsSceneCollection(
        buildObsSceneCollection({
          overlayUrl: this.overlayUrls.overlay_url,
          collectionName: `Saisonmanager – ${label}`,
        }),
        `saisonmanager-obs-szenen-${this.game?.game_day_id ?? 'spieltag'}.json`
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

  private initCoachCount(
    coaches: GameAdditionalFields['home_team_coaches'] | undefined
  ): number {
    if (!coaches) return 1;
    type CoachKey = keyof GameAdditionalFields['home_team_coaches'];
    for (let i = 5; i >= 2; i--) {
      const fn = coaches[`coach${i}_first_name` as CoachKey];
      const ln = coaches[`coach${i}_last_name` as CoachKey];
      const str = coaches[`coach${i}_string` as CoachKey];
      if (fn || ln || str) return i;
    }
    return 1;
  }

  addCoach(team: 'home' | 'guest'): void {
    if (team === 'home' && this.homeCoachNums.length < 5) {
      this.homeCoachNums = [
        ...this.homeCoachNums,
        this.homeCoachNums.length + 1,
      ];
    } else if (team === 'guest' && this.guestCoachNums.length < 5) {
      this.guestCoachNums = [
        ...this.guestCoachNums,
        this.guestCoachNums.length + 1,
      ];
    }
  }

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.fieldSize = league.field_size;

            this._cdr.markForCheck();
          }
        })
      )
      .subscribe();

    this.loadOverlayLink();
  }

  ngOnDestroy(): void {
    window.clearTimeout(this._copyResetTimer);
  }

  reloadGame() {
    this.handleReload.emit();
  }

  public openSquadHistoryHomeDialog() {
    this.squadHistoryDialogOpen =
      this.squadHistoryDialogOpen !== '' ? '' : 'home';
  }

  public openSquadHistoryGuestDialog() {
    this.squadHistoryDialogOpen =
      this.squadHistoryDialogOpen !== '' ? '' : 'guest';
  }

  public openAddHomeDialog() {
    this.addDialogOpen = this.addDialogOpen !== '' ? '' : 'home';
  }

  public openAddGuestDialog() {
    this.addDialogOpen = this.addDialogOpen !== '' ? '' : 'guest';
  }

  public closeAddDialog() {
    this.addDialogOpen = '';
    this.reloadGame();
  }

  public closeSquadHistoryDialog() {
    this.squadHistoryDialogOpen = '';
  }

  public startEvents() {
    this.handleGameStatusChange.emit();
  }
}
