import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { LeagueWithOperation } from '@floorball/types';

@Component({
  selector: 'fb-favorites-navigation',
  templateUrl: './favorites-navigation.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesNavigationComponent {
  @Input()
  favorites!: LeagueWithOperation[];
}
