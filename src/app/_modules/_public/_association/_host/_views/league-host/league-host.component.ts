import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
} from '@floorball/core';
import {
  GameOperation,
  GameScheduleEntry,
  League,
  Season,
} from '@floorball/types';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  retry,
  Subject,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';

@Component({
  templateUrl: './league-host.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LeagueHostComponent implements OnInit, OnDestroy {
  selectedLeague$!: Observable<League | null>;
  selectedAssociation$!: Observable<GameOperation | null>;
  selectedSeason$!: Observable<Season | null>;
  matches$?: Observable<GameScheduleEntry[] | null>;
  displayAssociationHeader$!: BehaviorSubject<boolean>;
  activeBanner$!: Observable<{ url: string; linkUrl?: string | null } | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _associationService: AssociationService,
    private _route: ActivatedRoute,
    private _favoriteService: FavoriteService
  ) {}

  ngOnDestroy(): void {
    this._leagueService.clearLeague();
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this.displayAssociationHeader$ =
      this._associationService.displayAssociationHeader$;
    this.selectedLeague$ = this._leagueService.selectedLeague$;
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.selectedSeason$ = this._associationService.selectedSeason$;

    // Werbebanner (Liga-Banner hat Vorrang vor Landesverband-Banner) – auf
    // dem Desktop mittig in der Kopfzeile statt in der Seitenleiste.
    this.activeBanner$ = combineLatest([
      this._leagueService.selectedLeague$,
      this._associationService.selectedStateAssociation$,
    ]).pipe(
      map(([league, sa]) => {
        if (league?.banner_url) {
          return { url: league.banner_url, linkUrl: league.banner_link_url };
        }
        if (sa?.banner_url) {
          return { url: sa.banner_url, linkUrl: sa.banner_link_url };
        }
        return null;
      })
    );

    this._route.params
      .pipe(
        tap(() => {
          this._leagueService.selectLeague(this._route);
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();

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

  addToFavorites(league: League): void {
    this._favoriteService.addToFavorites(league);
  }

  removeFavorite(leagueId: number) {
    this._favoriteService.removeFavorite(leagueId);
  }

  isLeagueFavorite(leagueId: number): boolean {
    return this._favoriteService.isLeagueFavorite(leagueId);
  }

  getMatches(leagueNumber: number) {
    this.matches$ = timer(1, 30000).pipe(
      switchMap(() =>
        this._leagueService
          .getGameScheduleForCurrentGameDay(leagueNumber)
          .pipe()
      ),
      retry(),
      takeUntil(this._destroy$)
    );
  }
}
