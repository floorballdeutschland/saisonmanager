import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LeagueService } from '@floorball/core';
import { League } from '@floorball/types';
import { Observable, tap } from 'rxjs';

@Component({
  templateUrl: './league-host.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LeagueHostComponent implements OnInit {
  selectedLeague$!: Observable<League | null>;

  constructor(
    private _leagueService: LeagueService,
    private _route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.selectedLeague$ = this._leagueService.selectedLeague$;

    this._route.params
      .pipe(
        tap((_params) => {
          this._leagueService.selectLeague(this._route);
        })
      )
      .subscribe();
  }
}
