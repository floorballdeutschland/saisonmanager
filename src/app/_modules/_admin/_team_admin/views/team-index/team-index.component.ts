import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { AssociationService, LeagueService } from '@floorball/core';
import { LeagueWithTeams } from 'src/app/_models';
import { Observable, share, Subject, take, takeUntil } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

interface FlatLeague {
  id: number;
  name: string;
  goName: string;
}

@Component({
  templateUrl: './team-index.component.html',
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class TeamIndexComponent implements OnInit, OnDestroy {
  league$?: Observable<LeagueWithTeams>;

  showImport = false;
  allLeagues: FlatLeague[] = [];
  importSourceLeagueId: number | null = null;
  importTopN = 2;
  importResult: { imported: number; skipped: number; failed: number } | null =
    null;
  importing = false;

  private _leagueId = 0;
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
        this._leagueId = +params['leagueId'];
        this.league$ = this._leagueService
          .getLeagueWithTeams(params['leagueId'])
          .pipe(share());

        this._leagueService
          .getAdminLeagues()
          .pipe(take(1), takeUntil(this._destroy$))
          .subscribe((groups) => {
            this.allLeagues = groups.flatMap((g) =>
              (g.leagues || []).map((l) => ({
                id: l.id,
                name: l.name,
                goName: g.name,
              }))
            );
            this._cdr.markForCheck();
          });

        this._cdr.markForCheck();
      }
    });
  }

  public importTeams(): void {
    if (!this.importSourceLeagueId || !this._leagueId) return;
    this.importing = true;
    this.importResult = null;
    this._leagueService
      .adminImportTeams(
        this._leagueId,
        this.importSourceLeagueId,
        this.importTopN
      )
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.importResult = result;
          this.importing = false;
          this.league$ = this._leagueService
            .getLeagueWithTeams(this._leagueId)
            .pipe(share());
          this._cdr.markForCheck();
        },
        error: () => {
          this.importing = false;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }
}
