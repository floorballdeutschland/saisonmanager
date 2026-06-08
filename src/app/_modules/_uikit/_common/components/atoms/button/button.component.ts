import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'fb-button',
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ButtonComponent {
  @Input()
  icon?: 'add' | 'remove' | 'edit' | 'save' | 'cancel' | 'expand';

  @Input()
  variant?: 'default' | 'success' | 'warning' | 'error';

  @Input()
  size: 'default' | 'small' | 'large' = 'default';

  @Input()
  fullWidth = false;

  @Input()
  disabled = false;

  @Input()
  iconAfter = false;

  @Input()
  title?: string;

  @Output()
  handleClick = new EventEmitter<void>();
}
