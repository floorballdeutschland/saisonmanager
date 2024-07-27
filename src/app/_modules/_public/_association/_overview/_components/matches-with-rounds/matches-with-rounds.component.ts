import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { LeagueService } from '@floorball/core';
import { GameScheduleEntry, League } from '@floorball/types';
import {
  interval,
  Observable,
  shareReplay,
  Subject,
  Subscription,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'fb-matches-with-rounds',
  templateUrl: './matches-with-rounds.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchesWithRoundsComponent implements OnInit, OnDestroy {
  selectedLeague$!: Observable<League | null>;
  selectedMatchDay = 1;
  matches$?: Observable<GameScheduleEntry[] | null>;
  intervalSub?: Subscription;

  private _destroy$ = new Subject<boolean>();

  constructor(private _leagueService: LeagueService) {}

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this.selectedLeague$ = this._leagueService.selectedLeague$;

    this.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            if (this.intervalSub) {
              this.intervalSub.unsubscribe();
            }

            this.getMatches(league.id);

            const timeout = environment.archiveMode ? 86400000 : 30000;
            this.intervalSub = interval(timeout)
              .pipe(
                tap(() => this.getMatches(league.id)),
                takeUntil(this._destroy$)
              )
              .subscribe();
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  getMatches(leagueNumber: number) {
    this.matches$ = this._leagueService
      .getGameScheduleForCurrentGameDay(leagueNumber)
      .pipe(shareReplay());

    this.matches$
      .pipe(
        take(1),
        tap((games) => {
          if (!games || !games[0]) {
            return;
          }
          this.selectedMatchDay = games[0].game_day;
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  selectMatchDay(matchDay: number, leagueNumber: number) {
    this.selectedMatchDay = matchDay;

    this.matches$ = this._leagueService.getGameScheduleForGameDay(
      leagueNumber,
      matchDay
    );
  }
}
