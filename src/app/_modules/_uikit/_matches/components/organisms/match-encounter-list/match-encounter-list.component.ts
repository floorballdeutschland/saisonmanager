import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-match-encounter-list',
  templateUrl: './match-encounter-list.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchEncounterListComponent {
  @Input()
  matches!: unknown[];
}
