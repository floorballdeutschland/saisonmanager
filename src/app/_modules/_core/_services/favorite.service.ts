import { Injectable } from '@angular/core';
import { AssociationService, StorageService } from '@floorball/core';
import {
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

  constructor(
    private _storageService: StorageService,
    private _associationService: AssociationService
  ) {
    this.getFavorites();
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
}
