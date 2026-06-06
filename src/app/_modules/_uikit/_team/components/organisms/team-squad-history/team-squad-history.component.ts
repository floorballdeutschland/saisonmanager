import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-team-squad-history',
  templateUrl: './team-squad-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class TeamSquadHistoryComponent {
  @Input() team!: string;
  @Output() handleClose: EventEmitter<void> = new EventEmitter<void>();

  onClose(): void {
    this.handleClose.emit();
  }
}
