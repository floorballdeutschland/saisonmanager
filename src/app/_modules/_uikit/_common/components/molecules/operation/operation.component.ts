import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GameOperation } from '@floorball/types';

@Component({
  selector: 'fb-operation',
  templateUrl: './operation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class OperationComponent {
  @Input()
  gameOperation!: GameOperation;

  @Input()
  full = false;
}
