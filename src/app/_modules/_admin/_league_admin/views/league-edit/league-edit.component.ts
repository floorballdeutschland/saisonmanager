import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  AssociationService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import { GameOperation, League } from 'src/app/_models';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { GameOperationWithLeagues } from 'src/app/_models/game-operation.interface';

@Component({
  templateUrl: './league-edit.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LeagueEditComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  leagueId?: number;
  league?: League;
  permittedGameOperations: GameOperationWithLeagues[] = [];

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._leagueService.getAdminLeagues().subscribe({
      next: (result) => {
        // this is the case, when we have enough permissions
        this.permittedGameOperations = result;

        this._route.params.subscribe((params) => {
          if (params['leagueId']) {
            this._leagueService
              .getSingleLeague(parseInt(params['leagueId']))
              .subscribe((league) => {
                this.league = league;

                console.log(this.league);
              });
          } else {
            this.league = this.newLeague;
            console.log(this.league);
          }
        });
      },
      error: (error) => {
        console.log(error);
        this._notificationService.error(
          'Dieser Bereich steht dir nicht zur Verfügung.'
        );
      },
    });
  }

  public get newLeague(): League {
    const league: League = {
      id: 0,
      game_operation_id: 0,
      game_operation_name: '',
      league_category_id: '',
      league_class_id: '',
      league_system_id: '',
      name: '',
      female: false,
      enable_scorer: true,
      short_name: '',
      season_id: '0',
      order_key: '1',
      league_type: 'league',
      game_day_numbers: [],
      game_day_titles: [],
    };

    return league;
  }
}
