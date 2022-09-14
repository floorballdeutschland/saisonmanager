import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  ArenaService,
  AssociationService,
  ClubService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import { Arena, Club, Gameday } from '@floorball/types';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  templateUrl: './game-day-edit.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class GameDayEditComponent implements OnInit {
  public gameday!: Gameday;
  public leagueId?: number;
  public editMode = true;

  public areans: Arena[] = [];
  public clubs: Club[] = [];

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _arenaService: ArenaService,
    private _clubService: ClubService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    // this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._arenaService.getArenas().subscribe({
      next: (arenas) => (this.areans = arenas),
    });

    this._clubService.getAdminClubAll().subscribe({
      // next: clubs => this.clubs = clubs;
    });

    this._route.params.subscribe((params) => {
      this.leagueId = params['leagueId'];

      if (params['gameDayId']) {
        // this.getGameday(params['gameDayId']);
      } else {
        this.editMode = false;
        this.newGameday();
      }
    });
  }

  public newGameday() {
    this.gameday = {
      id: 0,
      number: 0,
      date: '',
      arena_id: 0,
      club_id: 0,
      league_id: 0,
    };

    this._cdr.markForCheck();
  }

  // public error(league: League): boolean {
  //   return this.errorMsg(league).length > 0;
  // }

  // public errorMsg(league: League): string[] {
  //   // eslint-disable-next-line prefer-const
  //   let msg = [];
  //
  //   return msg;
  // }

  // public submit(league: League) {
  //
  // }
}
