import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Observable, Subject, takeUntil, tap } from 'rxjs';
import { GameScheduleEntry } from '@floorball/types';
import { LeagueService } from '@floorball/core';

@Component({
  selector: 'fb-all-matches',
  templateUrl: './all-matches.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllMatchesComponent implements OnInit, OnDestroy {
  matches$?: Observable<GameScheduleEntry[] | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(private _leagueService: LeagueService) {}

  ngOnInit() {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.getMatches(league.id);
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

  getMatches(leagueNumber: number) {
    this.matches$ = this._leagueService.getGameSchedule(leagueNumber);
  }
}
