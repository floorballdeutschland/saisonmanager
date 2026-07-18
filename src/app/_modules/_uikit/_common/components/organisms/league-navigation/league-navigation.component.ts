import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { GameOperation, League, Season } from '@floorball/types';

@Component({
  selector: 'fb-league-navigation',
  templateUrl: './league-navigation.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LeagueNavigationComponent {
  @Input()
  leagues!: League[];

  // Auf der Startseite (kein Spielbetrieb gewählt) zeigt das Seitenmenü statt
  // der Liga-Liste diese Spielbetriebe als Einstiegspunkte an.
  @Input()
  associations: GameOperation[] = [];

  @Input()
  selectedAssociation!: GameOperation | null;

  @Input()
  seasons: Season[] = [];

  @Input()
  selectedSeasonId: number | null = null;

  @Output()
  seasonChange = new EventEmitter<number>();

  onSeasonChange(event: Event) {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    this.seasonChange.emit(id);
  }
}
