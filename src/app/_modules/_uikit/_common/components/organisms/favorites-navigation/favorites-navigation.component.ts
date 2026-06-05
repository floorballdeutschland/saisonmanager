import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { FavoriteTeam, LeaguesWithOperation } from '@floorball/types';

@Component({
  selector: 'fb-favorites-navigation',
  templateUrl: './favorites-navigation.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FavoritesNavigationComponent {
  @Input()
  favorites!: LeaguesWithOperation[];

  @Input()
  favoriteTeams: FavoriteTeam[] = [];

  @Output()
  removeFavorite = new EventEmitter<number>();

  @Output()
  removeTeamFavorite = new EventEmitter<number>();
}
