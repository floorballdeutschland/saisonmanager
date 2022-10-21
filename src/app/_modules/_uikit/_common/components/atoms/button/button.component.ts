import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fb-button',
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  @Input()
  icon?: 'add' | 'remove' | 'edit' | 'save' | 'cancel';

  @Input()
  variant?: 'default' | 'success' | 'warning' | 'error';

  @Input()
  size: 'default' | 'large' = 'default';

  @Input()
  fullWidth = false;

  @Input()
  disabled = false;

  @Output()
  handleClick = new EventEmitter<void>();
}
