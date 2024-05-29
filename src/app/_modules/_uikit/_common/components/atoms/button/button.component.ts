import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fb-button',
  templateUrl: './button.component.html',
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

  @Output()
  handleClick = new EventEmitter<void>();
}
