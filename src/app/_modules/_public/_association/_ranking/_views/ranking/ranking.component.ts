import {
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { Observable, Subject, takeUntil, tap } from 'rxjs';
import { TableEntry } from '@floorball/types';
import { LeagueService } from '@floorball/core';

@Component({
  templateUrl: './ranking.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingComponent implements OnInit, OnDestroy {
  teamRankings$?: Observable<TableEntry[] | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.getTeamRanking(league.id);
            this._cdr.markForCheck();
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  getTeamRanking(leagueNumber: number) {
    this.teamRankings$ = this._leagueService.getTable(leagueNumber);
  }
}
