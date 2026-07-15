import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
} from '@floorball/core';
import {
  FavoriteTeam,
  GameOperation,
  League,
  LeaguesWithOperation,
  Season,
  StateAssociation,
} from '@floorball/types';
import { BehaviorSubject, combineLatest, map, Observable, Subject } from 'rxjs';

@Component({
  selector: 'fb-mobile-header',
  templateUrl: './mobile-header.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MobileHeaderComponent implements OnInit {
  isLoading$!: Observable<boolean>;
  leagues$!: Observable<League[] | null>;
  seasons$!: Observable<Season[]>;
  selectedSeasonId$!: Observable<number | null>;
  selectedAssociation$!: Observable<GameOperation | null>;
  selectedStateAssociation$!: Observable<StateAssociation | null>;
  activeBanner$!: Observable<{ url: string; linkUrl?: string | null } | null>;
  favoriteLeagues$?: BehaviorSubject<LeaguesWithOperation[]>;
  favoriteTeams$?: BehaviorSubject<FavoriteTeam[]>;

  @Output()
  closeNavigationOverlay: EventEmitter<boolean> = new EventEmitter<boolean>();

  @ViewChild('closeButton')
  closeButton!: ElementRef<HTMLButtonElement>;

  onClose$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _favoriteService: FavoriteService
  ) {}

  ngOnInit(): void {
    this.isLoading$ = this._associationService.associationsIsLoading$;
    this.leagues$ = this._leagueService.leagues$;
    this.seasons$ = this._associationService.seasons$;
    this.selectedSeasonId$ = this._associationService.currentSeasonId$;
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.selectedStateAssociation$ =
      this._associationService.selectedStateAssociation$;
    this.favoriteLeagues$ = this._favoriteService.favoriteLeagues$;
    this.favoriteTeams$ = this._favoriteService.favoriteTeams$;

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

  close() {
    this.onClose$.next(true);
  }

  // Bewusst ohne close(): Nach dem Saisonwechsel lädt die Ligenliste im Menü
  // neu, damit der Nutzer direkt eine Liga der neuen Saison auswählen kann.
  onSeasonChange(event: Event) {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    this._associationService.selectSeason(id);
  }

  removeFavoriteLeague(id: number): void {
    this._favoriteService.removeFavorite(id);
  }

  removeFavoriteTeam(id: number): void {
    this._favoriteService.removeTeamFavorite(id);
  }
}
