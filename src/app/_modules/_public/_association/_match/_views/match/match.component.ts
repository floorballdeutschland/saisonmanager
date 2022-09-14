import {
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  Game,
  GameOperation,
  Penalty,
  PenaltyCode,
  GameAdditionalFields,
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

@Component({
  templateUrl: './match.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchComponent implements OnInit, OnDestroy {
  @ViewChild('sbbNavigation')
  sbbNavigation!: ElementRef<HTMLElement>;

  game?: Game;
  additionalFields?: GameAdditionalFields;
  selectedAssociation$!: Observable<GameOperation | null>;

  public isLoggedIn$ = this._sessionService.isLoggedIn$;
  public tab = 'public';
  public event = '';
  public addDialogOpen = '';
  public squadHistoryDialogOpen = '';
  public currentPeriod = '1';
  public penalties: Penalty[] = [];
  public penaltyCodes: PenaltyCode[] = [];

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

    this._route.params.subscribe({
      next: (params) => {
        if (params['matchId']) {
          this.getMatch(params['matchId']);
        }
      },
    });

    this._leagueService.getPenalties().subscribe({
      next: (penalties) => {
        this.penalties = penalties;
      },
    });

    this._leagueService.getPenaltyCodes().subscribe({
      next: (penalties) => {
        this.penaltyCodes = penalties;
      },
    });
  }

  getMatch(id: string) {
    this._gameService.getGame(parseInt(id, 10)).subscribe({
      next: (game) => {
        if (this.tab !== 'public') {
          this._gameService.getAdditionalFields(parseInt(id, 10)).subscribe({
            next: (additionalFields) => {
              this.additionalFields = additionalFields;
              this.updateGame(game);
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
      this.event = '';
    }
  }

  public updateGame(game: Game) {
    this.game = game;

    this._metaTitle.setTitle(
      `Spiel ${game.home_team_name} gegen ${game.guest_team_name} - ${game.league_name} | Floorball Saisonmanager`
    );

    this._cdr.markForCheck();
  }

  navigateBack() {
    this._location.back();
  }

  scrollToSbbNavigation() {
    this.sbbNavigation.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  public isTabActive(tabName: string): boolean {
    return this.tab === tabName;
  }

  public setTab(tabName: string) {
    this.tab = tabName;
    this.reloadGame();
    this._cdr.markForCheck();
  }

  public setEvent(eventName: string): void {
    if (this.event === eventName) {
      this.event = '';
    } else {
      this.event = eventName;
    }
    this._cdr.markForCheck();
  }

  public isEventActive(eventName: string): boolean {
    return this.event === eventName;
  }

  public openAddHomeDialog() {
    this.addDialogOpen = this.addDialogOpen !== '' ? '' : 'home';
  }

  public openAddGuestDialog() {
    this.addDialogOpen = this.addDialogOpen !== '' ? '' : 'guest';
  }

  public closeAddDialog() {
    this.addDialogOpen = '';

    this._route.params.forEach((value) => {
      this.getMatch(value['matchId']);
    });
  }

  public openSquadHistoryHomeDialog() {
    this.squadHistoryDialogOpen =
      this.squadHistoryDialogOpen !== '' ? '' : 'home';
  }

  public openSquadHistoryGuestDialog() {
    this.squadHistoryDialogOpen =
      this.squadHistoryDialogOpen !== '' ? '' : 'guest';
  }

  public closeSquadHistoryDialog() {
    this.squadHistoryDialogOpen = '';
  }

  public canEdit(game: Game): boolean {
    if (game.permission) {
      return game.permission.includes('edit_game_report');
    } else {
      return false;
    }
  }

  public setCurrentPeriod(period: string) {
    this.currentPeriod = period;
  }

  public getCoachByNumber(side: string, num: number): string {
    switch (num) {
      case 1:
        console.log(this.additionalFields?.home_team_coaches);
        return side === 'home'
          ? `${
              this.additionalFields?.home_team_coaches.coach1_first_name || ''
            }###${
              this.additionalFields?.home_team_coaches.coach1_last_name || ''
            }`
          : `${
              this.additionalFields?.guest_team_coaches.coach1_first_name || ''
            }###${
              this.additionalFields?.guest_team_coaches.coach1_last_name || ''
            }`;
      case 2:
        return side === 'home'
          ? this.additionalFields?.home_team_coaches.coach2_string || ''
          : this.additionalFields?.guest_team_coaches.coach2_string || '';
      case 3:
        return side === 'home'
          ? this.additionalFields?.home_team_coaches.coach3_string || ''
          : this.additionalFields?.guest_team_coaches.coach3_string || '';
      case 4:
        return side === 'home'
          ? this.additionalFields?.home_team_coaches.coach4_string || ''
          : this.additionalFields?.guest_team_coaches.coach4_string || '';
      case 5:
        return side === 'home'
          ? this.additionalFields?.home_team_coaches.coach5_string || ''
          : this.additionalFields?.guest_team_coaches.coach5_string || '';
    }

    return '';
  }
}
