import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LeagueService } from '@floorball/core';
import { GameScheduleEntry, League } from '@floorball/types';
import { Observable, shareReplay, Subject, take, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'fb-tournament-matches',
  templateUrl: './tournament-matches.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TournamentMatchesComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<boolean>();

  round = 0;

  constructor(private _leagueService: LeagueService) {}

  @Input()
  selectedLeague?: League;

  matches$?: Observable<GameScheduleEntry[]>;

  getMatches(leagueNumber: number) {
    this.matches$ = this._leagueService
      .getGameSchedule(leagueNumber)
      .pipe(shareReplay());

    this.matches$.pipe(take(1), takeUntil(this._destroy$)).subscribe();
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
            this.getMatches(league.id);
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }
}
