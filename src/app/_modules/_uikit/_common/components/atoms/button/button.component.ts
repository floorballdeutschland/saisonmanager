import { Component, Input } from '@angular/core';

@Component({
  selector: 'fb-button',
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  @Input()
  icon?: 'add' | 'remove' | 'edit' | 'save' | 'cancel';

  @Input()
  variant?: 'default' | 'success' | 'warning' | 'error';
}
