import {
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { LeagueService } from '@floorball/core';
import { GroupedTableEntry, League } from '@floorball/types';
import { Observable, Subject, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'fb-tournament-matches-group',
  templateUrl: './tournament-matches-group.component.html',
})
export class TournamentMatchesGroupComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<boolean>();

  round = 0;
  teamRanking: GroupedTableEntry[] = [];

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  @Input()
  selectedLeague?: League;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  @Input()
  matches$?: Observable<any>; // TODO: please provide a type
  /* eslint-enable @typescript-eslint/no-explicit-any */

  getTeamRanking(leagueNumber: number) {
    this._leagueService
      .getGroupedTable(leagueNumber)
      .pipe(
        tap((group) => {
          this.teamRanking = Object.values(group);
          this._cdr.markForCheck();
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          console.log(league?.id);
          if (league?.id) {
            this.getTeamRanking(league.id);
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }
}
