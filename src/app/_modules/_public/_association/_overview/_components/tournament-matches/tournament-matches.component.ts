import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { LeagueService } from '@floorball/core';
import { League, TableEntry } from '@floorball/types';
import { interval, Observable, Subject, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'fb-tournament-matches',
  templateUrl: './tournament-matches.component.html',
})
export class TournamentMatchesComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<boolean>();

  round = 1;
  teamRankings$?: Observable<TableEntry[] | null>;

  constructor(private _leagueService: LeagueService) {}

  @Input()
  selectedLeague?: League;

  @Input()
  matches$?: Observable<any>;

  getTeamRanking(leagueNumber: number) {
    this.teamRankings$ = this._leagueService.getTable(leagueNumber);
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.getTeamRanking(league.id);
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  // changeRound(newRound: int): void {
  //   this.
  // }
}
