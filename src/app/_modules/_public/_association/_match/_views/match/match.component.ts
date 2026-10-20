import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  interval,
  Observable,
  Subject,
  Subscription,
  takeUntil,
  tap,
} from 'rxjs';
import {
  Game,
  GameAdditionalFields,
  GameOperation,
  RefereeReportRecipient,
} from '@floorball/types';
import {
  AssociationService,
  GameService,
  LeagueService,
  SessionService,
} from '@floorball/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import {
  isPdfFile,
  PDF_UPLOAD_ACCEPT,
} from 'src/app/_helpers/_utils/pdf-upload';

@Component({
  templateUrl: './match.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MatchComponent implements OnInit, OnDestroy {
  game?: Game;
  additionalFields?: GameAdditionalFields;
  selectedAssociation$!: Observable<GameOperation | null>;

  intervalSub?: Subscription;
  // Das Spiel, das die Adresse gerade verlangt. Eine Antwort fuer ein anderes
  // wird verworfen, siehe getMatch.
  private _matchId?: string;
  public isLoggedIn$ = this._sessionService.isLoggedIn$;
  public tab = 'public';

  refereeReportUploading = false;
  readonly pdfUploadAccept = PDF_UPLOAD_ACCEPT;
  refereeReportUploaded = false;
  refereeReportFilename = '';
  refereeReportRequired = false;
  refereeReportRecipient: RefereeReportRecipient | null = null;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _gameService: GameService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _sessionService: SessionService,
    private _router: Router,
    private _cdr: ChangeDetectorRef,
    private _location: Location,
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {
    // _router.events.pipe(takeUntil(this._destroy$)).subscribe(() => {
    //   const matchId = this._route.snapshot?.paramMap.get('matchId');
    //   if (matchId) {
    //     this.getMatch(matchId);
    //   }
    // });
  }

  ngOnDestroy(): void {
    this._associationService.displayAssociationHeader$.next(true);
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this._associationService.displayAssociationHeader$.next(false);
    this.selectedAssociation$ = this._associationService.selectedAssociation$;

    const secretaryToken =
      this._route.snapshot.queryParamMap.get('secretary_token');
    if (secretaryToken) {
      sessionStorage.setItem('secretary_token', secretaryToken);
      // 'secretary', nicht 'sbb': isTabActive() vergleicht nur gegen 'public'
      // und 'secretary'. Mit 'sbb' war keiner der beiden Bereiche aktiv, es
      // rendete nur der Kopfbereich und die Seite blieb ohne Inhalt.
      this.tab = 'secretary';
      this._router.navigate([], {
        relativeTo: this._route,
        queryParams: { secretary_token: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    this._route.params.subscribe({
      next: (params) => {
        if (params['matchId']) {
          if (params['matchId'] !== this._matchId) {
            this.resetRefereeReport();
          }
          this._matchId = params['matchId'];
          this.getMatch(params['matchId']);

          if (this.intervalSub) {
            this.intervalSub.unsubscribe();
          }

          this.intervalSub = interval(30000)
            .pipe(
              tap(() => this.getMatch(params['matchId'], true)),
              takeUntil(this._destroy$)
            )
            .subscribe();
        }
      },
    });
  }

  // Die Seite bleibt beim Wechsel in ein anderes Spiel dieselbe Komponente.
  // Der Upload-Zustand gehört zum alten Spiel und fällt sofort weg, nicht erst
  // mit der Antwort für das neue: Scheitert dort ein Abruf, stünde sonst der
  // Upload-Bereich des alten Spiels über dem neuen.
  private resetRefereeReport(): void {
    this.refereeReportRequired = false;
    this.refereeReportRecipient = null;
    this.refereeReportUploaded = false;
    this.refereeReportFilename = '';
    this.refereeReportUploading = false;
  }

  get hasSecretaryToken(): boolean {
    return !!sessionStorage.getItem('secretary_token');
  }

  /**
   * `silent` unterscheidet den ersten Abruf vom Nachladen im 30-Sekunden-Takt:
   * Beim Nachladen bleibt ein Aussetzer ohne Meldung, die Ansicht behält ihren
   * Stand und der nächste Takt holt ihn nach.
   */
  getMatch(id: string, silent = false) {
    // Beim Wechsel in ein anderes Spiel laufen Abrufe fuer das alte weiter,
    // etwa das 30-Sekunden-Nachladen. Kaeme eine solche Antwort nach der des
    // neuen Spiels an, stuende wieder das alte Spiel auf der Seite, waehrend
    // die Adresse das neue zeigt.
    const stillCurrent = () => id === this._matchId;

    this._gameService.getGame(parseInt(id, 10), silent).subscribe({
      next: (game) => {
        if (!stillCurrent()) return;

        // Nur die Eingabe braucht die Zusatzfelder ohne Anmeldung, nicht der
        // Statistik-Reiter: Den sehen auch Besucher, und der Abruf liegt unter
        // user/.
        if (
          this.tab === 'secretary' ||
          this._sessionService.currentUser ||
          this.hasSecretaryToken
        ) {
          this._gameService
            .getAdditionalFields(parseInt(id, 10), silent)
            .subscribe({
              next: (additionalFields) => {
                if (!stillCurrent()) return;

                this.additionalFields = additionalFields;
                this.updateGame(game);

                if (this._sessionService.currentUser) {
                  this._gameService
                    .getRefereeReport(parseInt(id, 10), silent)
                    .subscribe({
                      next: (report) => {
                        if (!stillCurrent()) return;

                        this.refereeReportRequired = !!report.required;
                        this.refereeReportRecipient = report.recipient ?? null;
                        // Auch zurücksetzen: Die Seite bleibt beim Wechsel in ein
                        // anderes Spiel dieselbe Komponente.
                        this.refereeReportUploaded = !!report.uploaded;
                        this.refereeReportFilename = report.filename ?? '';
                        this._cdr.markForCheck();
                      },
                    });
                }
              },
              // Der Spielstand hängt sonst an einem Abruf, der ihn gar nicht
              // liefert: `updateGame` stand nur im Erfolgsfall der
              // Zusatzfelder, ein Fehlschlag dort ließ also auch das bereits
              // geladene Spiel liegen. Seit das Nachladen schweigt, wäre das
              // ein einfrierender Spielstand ohne jeden Hinweis.
              error: () => {
                if (stillCurrent()) this.updateGame(game);
              },
            });
        } else {
          this.updateGame(game);
        }
      },
    });
  }

  reloadGame() {
    if (this.game?.id) {
      this.getMatch(this.game.id.toString());
    }
  }

  public updateGame(game: Game) {
    if (JSON.stringify(game) !== JSON.stringify(this.game)) {
      this.game = game;

      // Der Statistik-Reiter gehört nur zu Tablet-Spielen. Wechselt die Seite
      // von dort in ein Spiel ohne Tablet-Daten, gibt es ihn nicht mehr.
      if (this.tab === 'stats' && !game.tablet_capture) {
        this.tab = 'public';
      }

      this._metaTitle.setTitle(
        `Spiel ${game.home_team_name} gegen ${game.guest_team_name} - ${game.league_name} | Floorball Saisonmanager`
      );
    }

    this._cdr.markForCheck();
  }

  navigateBack() {
    this._location.back();
  }

  // Ob ein Berichtsformular verlangt ist und wohin es geht, entscheidet die
  // API (GET referee_report, api#789). Die Seite leitet das nicht mehr selbst
  // aus den Strafen ab: Sie prüfte die Straf-id 5, und das ist die technische
  // Matchstrafe, die volle Matchstrafe blieb ohne Upload-Bereich.
  get hasIncidentReport(): boolean {
    return this.refereeReportRequired;
  }

  // Der Upload wird erst nach Abschluss des Spielberichts angeboten – also
  // dann, wenn die Erinnerungs-E-Mail an die Schiris rausgeht. Während der
  // Spielberichtseingabe (offener Bericht) erscheint er bewusst nicht.
  get reportClosed(): boolean {
    return (
      this.game?.game_status === 'match_record_closed' ||
      this.game?.game_status === 'finalized'
    );
  }

  onRefereeReportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.game) return;

    if (!isPdfFile(file)) {
      // Sonst löst dieselbe Datei beim erneuten Auswählen kein change aus.
      input.value = '';
      alert(this._transloco.translate('match.refereeReport.notPdf'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(this._transloco.translate('match.refereeReport.tooLarge'));
      return;
    }

    this.refereeReportUploading = true;
    this._cdr.markForCheck();

    // Wechselt die Seite während des Uploads in ein anderes Spiel, gehört die
    // Antwort zum alten und darf den Zustand des neuen nicht setzen.
    const gameId = this.game.id;
    const stillCurrent = () =>
      this._matchId === String(gameId) && this.game?.id === gameId;

    this._gameService.uploadRefereeReport(gameId, file).subscribe({
      next: (res) => {
        if (!stillCurrent()) return;

        this.refereeReportUploaded = true;
        this.refereeReportFilename = res.filename;
        this.refereeReportUploading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        if (!stillCurrent()) return;

        this.refereeReportUploading = false;
        this._cdr.markForCheck();
        alert(this._transloco.translate('match.refereeReport.uploadFailed'));
      },
    });
  }

  public isTabActive(tabName: string): boolean {
    return this.tab === tabName;
  }

  public setTab(tabName: string) {
    this.tab = tabName;
    this.reloadGame();
    this._cdr.markForCheck();
  }

  public canEdit(game: Game): boolean {
    if (game.permission) {
      return game.permission.includes('edit_game_report');
    } else {
      return false;
    }
  }
}
