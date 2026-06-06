import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-match-event-button',
  templateUrl: './match-event-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: false,
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

  @Output()
  setEvent: EventEmitter<string> = new EventEmitter<string>();

  constructor(private _cdr: ChangeDetectorRef) {}

  getEventString(): string {
    switch (this.type) {
      case 'goal':
        return 'Tor';
      case 'penalty':
        return 'Strafe';
      case 'timeout':
        return 'Time-Out';
      case 'next':
        return 'Spielabschnitt starten';
      default:
        return '';
    }
  }

  isActive(): boolean {
    return `${this.type}-${this.team}` === this.event;
  }

  handleButtonClick(eventType: string): void {
    this.setEvent.emit(eventType);
  }
}
