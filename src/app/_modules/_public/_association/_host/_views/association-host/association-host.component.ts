import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { AssociationService, LeagueService } from '@floorball/core';
import { GameOperation, League } from '@floorball/types';
import {
  filter,
  map,
  Observable,
  startWith,
  Subject,
  takeUntil,
  tap,
} from 'rxjs';

@Component({
  templateUrl: './association-host.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AssociationHostComponent implements OnInit, OnDestroy {
  selectedAssociation$!: Observable<GameOperation | null>;
  association$!: Observable<GameOperation[]>;
  leagues$?: Observable<League[] | null>;
  hasSelectedLeague$!: Observable<boolean>;
  activeBanner$!: Observable<{ url: string; linkUrl?: string | null } | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this._associationService.clearAssociation();
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.leagues$ = this._leagueService.leagues$;
    this.association$ = this._associationService.associations$;

    this.hasSelectedLeague$ = this._router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => !!this._route.snapshot.firstChild),
      startWith(!!this._route.snapshot.firstChild)
    );

    // Landesverband-Werbebanner – auf der Verbands-Startseite (z. B. /fvd) auf
    // dem Desktop oben rechts in der Kopfzeile. Mobil bleibt es im Menü.
    this.activeBanner$ =
      this._associationService.selectedStateAssociation$.pipe(
        map((sa) =>
          sa?.banner_url
            ? { url: sa.banner_url, linkUrl: sa.banner_link_url }
            : null
        )
      );

    this._route.params
      .pipe(
        tap(() => {
          this._associationService.selectAssociation(this._route);
          this._cdr.markForCheck();
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  safeBannerLink(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
        ? url
        : null;
    } catch {
      return null;
    }
  }
}
