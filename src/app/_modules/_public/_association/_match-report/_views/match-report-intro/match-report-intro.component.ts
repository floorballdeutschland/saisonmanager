import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Game } from '@floorball/types';

@Component({
  selector: 'fb-match-report-intro',
  templateUrl: './match-report-intro.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportIntroComponent {
  // Für die Overlay-Links. Wer nur überträgt, braucht sie, bevor die Eingabe
  // des Spielberichts gestartet ist.
  @Input()
  game!: Game;

  @Output()
  handleGameStatusChange = new EventEmitter<void>();

  public start() {
    this.handleGameStatusChange.emit();
  }
}
