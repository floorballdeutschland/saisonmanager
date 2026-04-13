import { Injectable } from '@angular/core';
import { AssociationService, StorageService } from '@floorball/core';
import {
  FavoriteTeam,
  GameOperation,
  League,
  LeaguesWithOperation,
  LeagueWithOperation,
} from '@floorball/types';
import { BehaviorSubject, take, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FavoriteService {
  // favoriteLeagues$: BehaviorSubject<{operation: GameOperation, leagues: LeagueWithOperation[]}[]> =
  //   new BehaviorSubject<{operation: GameOperation, leagues: LeagueWithOperation[]}[]>([]);
  favoriteLeagues$: BehaviorSubject<LeaguesWithOperation[]> =
    new BehaviorSubject<LeaguesWithOperation[]>([]);

  favoriteTeams$: BehaviorSubject<FavoriteTeam[]> = new BehaviorSubject<
    FavoriteTeam[]
  >([]);

  constructor(
    private _storageService: StorageService,
    private _associationService: AssociationService
  ) {
    this.getFavorites();
    this.getTeamFavorites();
  }

  addToFavorites(league: League): void {
    const storageItems = this._storageService.getItem('fav');
    let items: LeagueWithOperation[] = [];

    if (storageItems) {
      const parsedItems: LeagueWithOperation[] = JSON.parse(storageItems);
      items = [...parsedItems];

      if (parsedItems.some((item) => item.league?.id === league.id)) {
        return;
      }
    }

    this._associationService.selectedAssociation$
      .pipe(
        take(1),
        tap((association) => {
          if (association) {
            this._storageService.setItem(
              'fav',
              JSON.stringify([
                { league: league, operation: association },
                ...items,
              ])
            );
            this.getFavorites();
          }
        })
      )
      .subscribe();
  }

  getFavorites(): void {
    const storageLeagues = this._storageService.getItem('fav');

    this._associationService.currentSeasonId$
      .pipe(
        tap((currentSeasonId) => {
          if (storageLeagues) {
            // filter favorites by current season id; leagues of previous seasons are not accessible anymore
            const filteredStorageLeagues = JSON.parse(storageLeagues).filter(
              (league: { league: League; operation: GameOperation }) => {
                return league.league.season_id === currentSeasonId.toString();
              }
            );

            // group leagues by association to display them separately in the frontend
            // this can be useful due to the fact that there can be the same league
            // titles across multiple associations
            const groupedLeagues = filteredStorageLeagues.reduce(
              (
                acc: { [operationId: number]: LeaguesWithOperation },
                item: { league: League; operation: GameOperation }
              ) => {
                return {
                  ...acc,
                  [item.operation.id]: {
                    ...(acc?.[item.operation.id] || {}),
                    operation: item.operation,
                    leagues: [
                      ...(acc?.[item.operation.id]?.leagues || []),
                      item.league,
                    ],
                  },
                };
              },
              {}
            );

            this.favoriteLeagues$.next(Object.values(groupedLeagues));
          }
        })
      )
      .subscribe();
  }

  removeFavorite(leagueId: number): void {
    const storageLeagues = this._storageService.getItem('fav');

    if (storageLeagues) {
      const parsedItems: LeagueWithOperation[] = JSON.parse(storageLeagues);

      const filteredItems = parsedItems.filter(
        (leagueWithOperation) => leagueWithOperation.league.id !== leagueId
      );

      this._storageService.setItem('fav', JSON.stringify(filteredItems));
      this.getFavorites();
    }
  }

  isLeagueFavorite(leagueId: number): boolean {
    const storageItems = this._storageService.getItem('fav');

    if (storageItems) {
      const parsedItems: LeagueWithOperation[] = JSON.parse(storageItems);
      return parsedItems.some((item) => item.league?.id === leagueId);
    }

    return false;
  }

  // --- Team favorites ---

  getTeamFavorites(): void {
    const stored = this._storageService.getItem('fav_teams');
    if (stored) {
      this.favoriteTeams$.next(JSON.parse(stored) as FavoriteTeam[]);
    }
  }

  addTeamToFavorites(team: FavoriteTeam): void {
    const stored = this._storageService.getItem('fav_teams');
    let items: FavoriteTeam[] = stored ? JSON.parse(stored) : [];

    if (items.some((t) => t.id === team.id)) {
      return;
    }

    items = [team, ...items];
    this._storageService.setItem('fav_teams', JSON.stringify(items));
    this.favoriteTeams$.next(items);
  }

  removeTeamFavorite(teamId: number): void {
    const stored = this._storageService.getItem('fav_teams');
    if (!stored) return;

    const items = (JSON.parse(stored) as FavoriteTeam[]).filter(
      (t) => t.id !== teamId
    );
    this._storageService.setItem('fav_teams', JSON.stringify(items));
    this.favoriteTeams$.next(items);
  }

  isTeamFavorite(teamId: number): boolean {
    const stored = this._storageService.getItem('fav_teams');
    if (!stored) return false;
    return (JSON.parse(stored) as FavoriteTeam[]).some((t) => t.id === teamId);
  }
}
