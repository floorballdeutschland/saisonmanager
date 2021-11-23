import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LeagueService } from '@floorball/core';
import { League } from '@floorball/types';
import { Observable, Subject, takeUntil, tap } from 'rxjs';

@Component({
  templateUrl: './league-host.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueHostComponent implements OnInit, OnDestroy {
  selectedLeague$!: Observable<League | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _route: ActivatedRoute
  ) {}

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this.selectedLeague$ = this._leagueService.selectedLeague$;

    this._route.params
      .pipe(
        tap(() => {
          this._leagueService.selectLeague(this._route);
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }
}
