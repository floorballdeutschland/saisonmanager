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

  // Benennt die Szenensammlung, die der Overlay-Abschnitt zum Herunterladen
  // anbietet. Der Zugang gilt für den ganzen Spieltag; die Spielnummer steht
  // trotzdem dran, weil man von hier aus genau dieses Spiel überträgt.
  public get overlayLabel(): string {
    return this.game?.game_number
      ? `Spiel ${this.game.game_number}`
      : 'Spieltag';
  }

  @Output()
  handleGameStatusChange = new EventEmitter<void>();

  public start() {
    this.handleGameStatusChange.emit();
  }
}
