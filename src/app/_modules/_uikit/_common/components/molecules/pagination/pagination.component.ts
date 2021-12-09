import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-pagination',
  templateUrl: './pagination.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class PaginationComponent {
  @Input()
  numberOfPages!: number;

  @Output()
  changePage: EventEmitter<number> = new EventEmitter<number>();
}
