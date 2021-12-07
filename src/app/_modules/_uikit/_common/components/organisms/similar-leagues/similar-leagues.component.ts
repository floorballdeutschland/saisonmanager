import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { League } from '@floorball/types';

@Component({
  selector: 'fb-similar-leagues',
  templateUrl: './similar-leagues.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimilarLeaguesComponent {
  @Input()
  leagues!: League[];
}
