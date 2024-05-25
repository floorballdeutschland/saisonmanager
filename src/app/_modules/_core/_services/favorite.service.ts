import { Injectable } from '@angular/core';
import { AssociationService, StorageService } from '@floorball/core';
import { GameOperation, League } from '@floorball/types';
import { init } from '@sentry/angular';
import { BehaviorSubject, take, tap } from 'rxjs';

interface LeagueWithOperation {
  league: League;
  operation: GameOperation;
}

@Injectable({
  providedIn: 'root',
})
export class FavoriteService {
  favoriteLeagues$: BehaviorSubject<LeagueWithOperation[]> =
    new BehaviorSubject<LeagueWithOperation[]>([]);

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
            this.favoriteLeagues$.next([
              { league: league, operation: association },
              ...items,
            ]);
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
            const filteredStorageLeagues = JSON.parse(storageLeagues).filter(
              (league: { league: League; operation: GameOperation }) => {
                return league.league.season_id === currentSeasonId.toString();
              }
            );

            this.favoriteLeagues$.next(filteredStorageLeagues);
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
      this.favoriteLeagues$.next(filteredItems);
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
