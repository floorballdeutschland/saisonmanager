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
import { Game, GameAdditionalFields, GameOperation } from '@floorball/types';
import {
  AssociationService,
  GameService,
  LeagueService,
  SessionService,
} from '@floorball/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';

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
  public isLoggedIn$ = this._sessionService.isLoggedIn$;
  public tab = 'public';

  refereeReportUploading = false;
  refereeReportUploaded = false;
  refereeReportFilename = '';

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
    private _metaTitle: Title
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
      this.tab = 'sbb';
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
          this.getMatch(params['matchId']);

          if (this.intervalSub) {
            this.intervalSub.unsubscribe();
          }

          this.intervalSub = interval(30000)
            .pipe(
              tap(() => this.getMatch(params['matchId'])),
              takeUntil(this._destroy$)
            )
            .subscribe();
        }
      },
    });
  }

  get hasSecretaryToken(): boolean {
    return !!sessionStorage.getItem('secretary_token');
  }

  getMatch(id: string) {
    this._gameService.getGame(parseInt(id, 10)).subscribe({
      next: (game) => {
        if (
          this.tab !== 'public' ||
          this._sessionService.currentUser ||
          this.hasSecretaryToken
        ) {
          this._gameService.getAdditionalFields(parseInt(id, 10)).subscribe({
            next: (additionalFields) => {
              this.additionalFields = additionalFields;
              this.updateGame(game);

              if (this._sessionService.currentUser) {
                this._gameService.getRefereeReport(parseInt(id, 10)).subscribe({
                  next: (report) => {
                    if (report.uploaded) {
                      this.refereeReportUploaded = true;
                      this.refereeReportFilename = report.filename ?? '';
                    }
                    this._cdr.markForCheck();
                  },
                });
              }
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

      this._metaTitle.setTitle(
        `Spiel ${game.home_team_name} gegen ${game.guest_team_name} - ${game.league_name} | Floorball Saisonmanager`
      );
    }

    this._cdr.markForCheck();
  }

  navigateBack() {
    this._location.back();
  }

  get hasIncidentReport(): boolean {
    if (!this.game) return false;
    const events =
      (this.game as Game & { events?: { penalty_id?: string | number }[] })
        .events ?? [];
    const hasSpielausschluss = events.some(
      (e) => e.penalty_id?.toString() === '5'
    );
    // Besonderes Ereignis oder Spielausschluss (rote Karte) lösen nach
    // Spielbericht-Abschluss die Erinnerungs-E-Mail an die Schiris aus, die
    // den Berichtsformular-Upload einfordert.
    return !!(this.additionalFields?.special_event || hasSpielausschluss);
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

    if (file.size > 5 * 1024 * 1024) {
      alert('Die Datei darf maximal 5 MB groß sein.');
      return;
    }

    this.refereeReportUploading = true;
    this._cdr.markForCheck();

    this._gameService.uploadRefereeReport(this.game.id, file).subscribe({
      next: (res) => {
        this.refereeReportUploaded = true;
        this.refereeReportFilename = res.filename;
        this.refereeReportUploading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.refereeReportUploading = false;
        this._cdr.markForCheck();
        alert('Upload fehlgeschlagen. Bitte erneut versuchen.');
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
