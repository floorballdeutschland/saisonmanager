import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { AssociationService, LeagueService } from '@floorball/core';
import { LeagueWithTeams } from 'src/app/_models';
import { Observable, share, Subject, take, takeUntil, tap } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  templateUrl: './team-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class TeamIndexComponent implements OnInit, OnDestroy {
  league$?: Observable<LeagueWithTeams>;
  loading$?: Observable<boolean>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['leagueId']) {
        console.log('_route');
        this.league$ = this._leagueService
          .getLeagueWithTeams(params['leagueId'])
          .pipe(share());

        this.league$
          .pipe(
            tap((league) => {
              if (!league) {
                return;
              }
            }),
            take(1),
            takeUntil(this._destroy$)
          )
          .subscribe();
        this._cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }
}
