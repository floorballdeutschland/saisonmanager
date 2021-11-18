import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-team-lineup',
  templateUrl: './team-lineup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TeamLineupComponent {
  @Input()
  // TODO: type;
  lineup!: any;
}
