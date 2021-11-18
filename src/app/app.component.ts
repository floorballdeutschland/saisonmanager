import { Component, OnInit } from '@angular/core';
import {
  ActivatedRoute,
  ActivationEnd,
  NavigationEnd,
  NavigationStart,
  Router,
} from '@angular/router';
import { AssociationService } from '@floorball/core';
import { tap } from 'rxjs';
import { GameService, LeagueService, MetaService } from './_services';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'saisonmanager';

  isLoading$;

  constructor(
    private _asociationService: AssociationService,
    private metaService: MetaService,
    private leagueService: LeagueService,
    private gameService: GameService,
    private _route: ActivatedRoute,
    private _router: Router
  ) {
    this.isLoading$ = this._asociationService.associationsIsLoading$;
  }

  ngOnInit(): void {
    // this.metaService.getInit().subscribe(
    //   (data) => {
    //     console.log('getInit', data);
    //   },
    //   (err) => {
    //     console.error('getInit', err);
    //   }
    // );
    // this.leagueService.getLeagues(1, 13).subscribe(
    //   (data) => {
    //     console.log('getLeagues', data);
    //   },
    //   (err) => {
    //     console.error('getLeagues', err);
    //   }
    // );
    // this.leagueService.getGameSchedule(1044).subscribe(
    //   (data) => {
    //     console.log('getGames', data);
    //   },
    //   (err) => {
    //     console.error('getGames', err);
    //   }
    // );
    // this.leagueService.getTable(1044).subscribe(
    //   (data) => {
    //     console.log('getTable', data);
    //   },
    //   (err) => {
    //     console.error('getTable', err);
    //   }
    // );
    // this.leagueService.getScorer(1044).subscribe(
    //   (data) => {
    //     console.log('getScorer', data);
    //   },
    //   (err) => {
    //     console.error('getScorer', err);
    //   }
    // );
    // this.gameService.getGame(24428).subscribe(
    //   (data) => {
    //     console.log('getScorer', data);
    //   },
    //   (err) => {
    //     console.error('getScorer', err);
    //   }
    // );
  }
}
