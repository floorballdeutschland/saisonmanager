import { Component, EventEmitter, OnInit, Output } from '@angular/core';

@Component({
  selector: 'fb-match-report-intro',
  templateUrl: './match-report-intro.component.html',
  styleUrls: ['./match-report-intro.component.scss'],
})
export class MatchReportIntroComponent {
  @Output()
  handleGameStatusChange = new EventEmitter<void>();

  public start() {
    this.handleGameStatusChange.emit();
  }
}
