import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-match-event-button',
  templateUrl: './match-event-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchEventButtonComponent {
  @Input()
  type!: string;

  @Input()
  team!: string;

  @Input()
  team_name!: string;

  @Input()
  event!: string;

  @Input()
  setEvent!: (eventType: string) => void;

  constructor(private _cdr: ChangeDetectorRef) {}

  getEventString(): string {
    switch (this.type) {
      case 'goal':
        return 'Tor';
      case 'penalty':
        return 'Strafe';
      case 'timeout':
        return 'Time-Out';
      default:
        return '';
    }
  }

  isActive(): boolean {
    return `${this.type}-${this.team}` === this.event;
  }

  handleButtonClick(eventType: string): void {
    this.setEvent(eventType);
    this._cdr.markForCheck();
  }
}
