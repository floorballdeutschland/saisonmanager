import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { GameService } from '@floorball/core';
import {
  Game,
  GameOperation,
  GamePlayerEntry,
  ScorerEntry,
  TableEntry,
} from '@floorball/models';

@Component({
  selector: 'fb-styleguide',
  templateUrl: './styleguide.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StyleguideComponent {
  playerRankingMock: ScorerEntry[] = [
    {
      last_name: 'Last',
      first_name: 'test',
      penalty_2: 2,
      assists: 1,
      penalty_10: 10,
      position: 1,
      player_id: 1,
      games: 3,
      goals: 3,
      penalty_2and2: 2,
      sort: 1,
      penalty_5: 5,
      penalty_ms: 2,
      image: '',
      image_small: '',
      team_name: 'team test',
      team_id: 1,
    },
    {
      last_name: 'Last',
      first_name: 'test',
      penalty_2: 2,
      assists: 1,
      penalty_10: 10,
      position: 1,
      player_id: 1,
      games: 3,
      goals: 3,
      penalty_2and2: 2,
      sort: 1,
      penalty_5: 5,
      penalty_ms: 2,
      image: '',
      image_small: '',
      team_name: 'team test',
      team_id: 1,
    },
    {
      last_name: 'Last',
      first_name: 'test',
      penalty_2: 2,
      assists: 1,
      penalty_10: 10,
      position: 1,
      player_id: 1,
      games: 3,
      goals: 3,
      penalty_2and2: 2,
      sort: 1,
      penalty_5: 5,
      penalty_ms: 2,
      image: '',
      image_small: '',
      team_name: 'team test',
      team_id: 1,
    },
  ];

  teamRankingMock: TableEntry[] = [
    {
      goals_diff: 20,
      games: 8,
      goals_received: 40,
      goals_scored: 60,
      sort: 1,
      draw: 2,
      team_id: 1,
      lost: 2,
      won: 4,
      position: 1,
      lost_ot: 2,
      team_name: 'Team Name',
      points: 50,
      team_logo: '',
      team_small_logo: '',
      point_corrections: {
        points: 5,
        team_name: 'Team Name',
        reason: 'test reason',
        reference_number: '1',
      },
      won_ot: 2,
    },
    {
      goals_diff: 20,
      games: 8,
      goals_received: 40,
      goals_scored: 60,
      sort: 1,
      draw: 2,
      team_id: 1,
      lost: 2,
      won: 4,
      position: 1,
      lost_ot: 2,
      team_name: 'Team Name',
      points: 50,
      team_logo: '',
      team_small_logo: '',
      point_corrections: {
        points: 5,
        team_name: 'Team Name',
        reason: 'test reason',
        reference_number: '1',
      },
      won_ot: 2,
    },
  ];

  lineupMock: GamePlayerEntry[] = [
    {
      player_id: 1,
      captain: false,
      goalkeeper: false,
      player_firstname: 'Firstname',
      player_name: 'Lastname',
      trikot_number: 12,
    },
    {
      player_id: 1,
      captain: false,
      goalkeeper: false,
      player_firstname: 'Firstname',
      player_name: 'Lastname',
      trikot_number: 12,
    },
    {
      player_id: 1,
      captain: false,
      goalkeeper: false,
      player_firstname: 'Firstname',
      player_name: 'Lastname',
      trikot_number: 12,
    },
  ];

  // gameMock: Game = {
  //   id: 7509,
  //   game_number: '101',
  //   start_time: '11:45',
  //   audience: 67,
  //   home_team_name: 'SG Wyk/Husum',
  //   guest_team_name: 'SG FTC+ Berlin',
  //   events: [],
  //   players: {
  //     home: [
  //       {
  //         player_id: 5181,
  //         player_name: 'Clausen',
  //         trikot_number: 6,
  //         player_firstname: 'Justus',
  //         goalkeeper: false,
  //       },
  //       {
  //         player_id: 1409,
  //         player_name: 'Obojiagbe',
  //         trikot_number: 7,
  //         player_firstname: 'Justin',
  //         goalkeeper: false,
  //       },
  //     ],
  //     guest: [
  //       {
  //         player_id: 13535,
  //         goalkeeper: true,
  //         player_name: 'Vaclavek',
  //         trikot_number: 1,
  //         player_firstname: 'Svatoslav',
  //       },
  //       {
  //         player_id: 4829,
  //         player_name: 'Reisig',
  //         trikot_number: 3,
  //         player_firstname: 'Adam',
  //         goalkeeper: false,
  //       },
  //     ],
  //   },
  //   arena_address: 'Leipzig, Sporthalle am Rabet',
  //   arena: 1,
  //   arena_name: 'Sporthalle am Rabet',
  //   arena_short: 'SPR',
  //   date: new Date(),
  //   game_operation_id: 1,
  //   ended: true,
  //   game_operation_name: 'Test Operation',
  //   game_operation_short_name: '',
  //   league_id: 1,
  //   league_name: 'test',
  //   league_short_name: 't',
  // };

  gameOperationMock: GameOperation = {
    name: 'Test Name',
    path: 'styleguide',
    logo_url: 'http://via.placeholder.com/260x61',
    id: 1,
    short_name: 'Tes',
  };

  game?: Game | null;

  constructor(private _gameService: GameService) {
    this._gameService.getGame(7110).subscribe((_) => {
      if (_) {
        this.game = _;
      }
    });
  }
}
