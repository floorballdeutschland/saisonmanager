import { Injectable } from '@angular/core';
import { StorageService } from '@floorball/core';
import { League } from '@floorball/types';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FavoriteService {
  favoriteLeagues$: BehaviorSubject<League[]> = new BehaviorSubject<League[]>(
    []
  );

  constructor(private _storageService: StorageService) {
    this.getFavorites();
  }

  addToFavorites(league: League): void {
    const storageItems = this._storageService.getItem('fav');
    let items: League[] = [];

    if (storageItems) {
      const parsedItems: League[] = JSON.parse(storageItems);
      items = [...parsedItems];

      if (parsedItems.some((item) => item.id === league.id)) {
        return;
      }
    }

    this._storageService.setItem('fav', JSON.stringify([league, ...items]));
    this.favoriteLeagues$.next([league, ...items]);
  }

  getFavorites(): void {
    const storageLeagues = this._storageService.getItem('fav');

    if (storageLeagues) {
      console.log('test', JSON.parse(storageLeagues));
      this.favoriteLeagues$.next(JSON.parse(storageLeagues));
    }
  }
}
