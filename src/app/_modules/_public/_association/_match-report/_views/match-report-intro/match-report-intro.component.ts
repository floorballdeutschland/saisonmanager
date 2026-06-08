import {
  Component,
  EventEmitter,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'fb-match-report-intro',
  templateUrl: './match-report-intro.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportIntroComponent {
  @Output()
  handleGameStatusChange = new EventEmitter<void>();

  public start() {
    this.handleGameStatusChange.emit();
  }
}
